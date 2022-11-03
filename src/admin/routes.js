const { Op } = require('sequelize');
module.exports = {
  setUp(router) {
    router.get('/admin/best-profession', async (req, res) => {
      const { Contract, Job } = req.app.get('models');
      const start = req.query.start;
      const end = req.query.end;
      // todo we could add validation checking if provided dates are in correct format and throw if they are not
      // in the current state providing invalid date to the database query it just won't return any results
      const jobs = await Job.findAll({
        where: {
          paymentDate: {
            [Op.lte]: new Date(end),
            [Op.gte]: new Date(start),
          },
        },
        include: {
          model: Contract,
          include: 'Contractor',
        },
      });
      if (jobs.length === 0) {
        return res.status(400).json({ message: 'No jobs found for specified timerange' });
      }
      const professionsEarnings = jobs.reduce((acc, current) => {
        const profession = current.Contract.Contractor.profession;
        if (acc[profession]) {
          acc[profession] += current.price;
        } else {
          acc[profession] = current.price;
        }
        return acc;
      }, {});

      let bestPaidProfession = '';
      let highestEarnings = 0;
      Object.entries(professionsEarnings).forEach(([profession, earnings]) => {
        if (earnings > highestEarnings) {
          bestPaidProfession = profession;
          highestEarnings = earnings;
        }
      });
      res.json({
        bestPaidProfession,
      });
    });

    router.get('/admin/best-clients', async (req, res) => {
      const { Contract, Job, Profile } = req.app.get('models');
      const start = req.query.start;
      const end = req.query.end;
      const limit = +req.query.limit || 2;

      const jobs = await Job.findAll({
        where: {
          paymentDate: {
            [Op.lte]: new Date(end),
            [Op.gte]: new Date(start),
          },
        },
        include: {
          model: Contract,
          include: 'Client',
        },
      });

      const clientsPayments = jobs.reduce((acc, current) => {
        const clientId = current.Contract.ClientId;
        if (acc[clientId]) {
          acc[clientId].paid += current.price;
        } else {
          acc[clientId] = {
            id: clientId,
            fullName: current.Contract.Client.firstName + current.Contract.Client.lastName,
            paid: current.price,
          };
        }
        return acc;
      }, {});

      const sortedPayments = Object.values(clientsPayments).sort((a, b) => b.paid - a.paid);

      // todo thing to consider is how we want to treat the situation where we have more than one client with the same value paid and we need to limit result
      // currently we just return exactly the number of items in the limit param; we could return all entries with the same value if some of them are inside the limit and the rest is over the limit

      res.json(sortedPayments.slice(0, limit));
    });
  },
};
