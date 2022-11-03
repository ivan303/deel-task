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

module.exports = app;
