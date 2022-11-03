const express = require('express');
const bodyParser = require('body-parser');
const { sequelize, CONTRACT_STATUSES } = require('./model');
const { getProfile } = require('./middleware/getProfile');
const app = express();
const { Op } = require('sequelize');
app.use(bodyParser.json());
app.set('sequelize', sequelize);
app.set('models', sequelize.models);

function canAccessContract(contract, profile) {
  return contract.ContractorId === profile.id || contract.ClientId === profile.id;
}

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models');
  const { id } = req.params;
  const contract = await Contract.findOne({ where: { id } });
  if (!contract || !canAccessContract(contract, req.profile)) {
    return res.status(404).end();
  }

  res.json(contract);
});

app.get('/contracts', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models');
  const contracts = await Contract.findAll({
    where: {
      [Op.or]: [{ ContractorId: req.profile.id }, { ClientId: req.profile.id }],
      status: [CONTRACT_STATUSES.NEW, CONTRACT_STATUSES.IN_PROGRESS],
    },
  });

  res.json(contracts);
});

app.get('/jobs/unpaid', getProfile, async (req, res) => {
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

app.get('/profile', getProfile, async (req, res) => {
  const { Profile } = req.app.get('models');
  const profile = await Profile.findOne({
    where: {
      id: req.profile.id,
    },
  });
  res.json(profile);
});

const JOB_NOT_FOUND_ERROR = 'JOB_NOT_FOUND_ERROR';
const INSUFFICIENT_FUNDS_ERROR = 'INSUFFICIENT_FUNDS_ERROR';
const JOB_ALREADY_PAID_ERROR = 'JOB_ALREADY_PAID_ERROR';

app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
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

module.exports = app;
