const { sequelize } = require('../model');

const DEPOSIT_TOO_BIG_ERROR = 'DEPOSIT_TOO_BIG_ERROR';
const PROFILE_NOT_FOUND_ERROR = 'PROFILE_NOT_FOUND_ERROR';

module.exports = {
  setUp(router) {
    router.post('/balances/deposit/:userId', async (req, res) => {
      // requiremts for this task are not entirely clear to me; I'll do my best
      const { Contract, Job, Profile } = req.app.get('models');
      const { userId } = req.params;
      const { deposit } = req.body;
      const t = await sequelize.transaction();

      if (isNaN(+deposit)) {
        return res.status(400).json({ message: 'Incorrect deposit value' });
      }

      try {
        const profile = await Profile.findOne({
          where: {
            id: userId,
          },
          include: {
            model: Contract,
            as: 'Client',
            include: Job,
          },
          transaction: t,
        });
        if (!profile) {
          throw Error(PROFILE_NOT_FOUND_ERROR);
        }
        let amoutToPay = 0;
        for (const contract of profile.Client) {
          for (const job of contract.Jobs) {
            if (!job.paid) {
              amoutToPay += job.price;
            }
          }
        }
        if (deposit > amoutToPay / 4) {
          throw Error(DEPOSIT_TOO_BIG_ERROR);
        }
        await Profile.update({ balance: profile.balance + deposit }, { where: { id: profile.id }, transaction: t });
        await t.commit();
      } catch (err) {
        await t.rollback();
        if (err.message === DEPOSIT_TOO_BIG_ERROR) {
          return res.status(400).json({ message: 'To much to deposit' });
        }
        if (err.message === PROFILE_NOT_FOUND_ERROR) {
          return res.status(404).json({ message: 'User not found' });
        }
        return res.status(500).end();
      }

      res.status(200).end();
    });
  },
};
