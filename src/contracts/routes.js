const { CONTRACT_STATUSES } = require('../model');
const { Op } = require('sequelize');
module.exports = {
  setUp(router) {
    router.get('/contracts/:id', async (req, res) => {
      const { Contract } = req.app.get('models');
      const { id } = req.params;
      const contract = await Contract.findOne({ where: { id } });
      if (!contract || !canAccessContract(contract, req.profile)) {
        return res.status(404).end();
      }

      res.json(contract);
    });

    router.get('/contracts', async (req, res) => {
      const { Contract } = req.app.get('models');
      const contracts = await Contract.findAll({
        where: {
          [Op.or]: [{ ContractorId: req.profile.id }, { ClientId: req.profile.id }],
          status: [CONTRACT_STATUSES.NEW, CONTRACT_STATUSES.IN_PROGRESS],
        },
      });

      res.json(contracts);
    });
  },
};

function canAccessContract(contract, profile) {
  return contract.ContractorId === profile.id || contract.ClientId === profile.id;
}
