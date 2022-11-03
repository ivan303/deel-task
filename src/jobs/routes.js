const { sequelize, CONTRACT_STATUSES } = require('../model');
const { Op } = require('sequelize');

const JOB_NOT_FOUND_ERROR = 'JOB_NOT_FOUND_ERROR';
const INSUFFICIENT_FUNDS_ERROR = 'INSUFFICIENT_FUNDS_ERROR';
const JOB_ALREADY_PAID_ERROR = 'JOB_ALREADY_PAID_ERROR';

module.exports = {
  setUp(router) {
    router.get('/jobs/unpaid', async (req, res) => {
      const { Contract, Job } = req.app.get('models');
      const jobs = await Job.findAll({
        include: {
          model: Contract,
          attributes: [],
          where: {
            [Op.or]: [{ ContractorId: req.profile.id }, { ClientId: req.profile.id }],
            status: CONTRACT_STATUSES.IN_PROGRESS,
          },
        },
        where: {
          paid: { [Op.not]: true },
        },
      });

      res.json(jobs);
    });

    router.post('/jobs/:job_id/pay', async (req, res) => {
      const { Contract, Job, Profile } = req.app.get('models');
      const { job_id: jobId } = req.params;
      const t = await sequelize.transaction();
      try {
        const job = await Job.findOne({
          where: {
            id: jobId,
          },
          include: {
            model: Contract,
            where: {
              ClientId: req.profile.id,
            },
            include: 'Contractor',
          },
          transaction: t,
        });
        if (!job) {
          throw Error(JOB_NOT_FOUND_ERROR);
        }
        if (job.paid) {
          throw Error(JOB_ALREADY_PAID_ERROR);
        }
        if (req.profile.balance < job.price) {
          throw Error(INSUFFICIENT_FUNDS_ERROR);
        }
        await Profile.update(
          { balance: req.profile.balance - job.price },
          {
            where: {
              id: req.profile.id,
            },
            transaction: t,
          }
        );
        await Profile.update(
          { balance: job.Contract.Contractor.balance + job.price },
          {
            where: {
              id: job.Contract.ContractorId,
            },
            transaction: t,
          }
        );
        await Job.update(
          { paid: true },
          {
            where: {
              id: job.id,
            },
            transaction: t,
          }
        );

        await t.commit();
      } catch (err) {
        await t.rollback();
        if (err.message === JOB_NOT_FOUND_ERROR) {
          return res.status(404).end();
        }
        if (err.message === INSUFFICIENT_FUNDS_ERROR) {
          return res.status(400).send({ message: 'Insufficient funds' });
        }
        if (err.message === JOB_ALREADY_PAID_ERROR) {
          return res.status(400).send({ message: 'Job already paid' });
        }
        return res.status(500).end();
      }

      res.status(200).end();
    });
  },
};
