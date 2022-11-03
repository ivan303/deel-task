const express = require('express');
const bodyParser = require('body-parser');
const { sequelize } = require('./model');
const { getProfile } = require('./middleware/getProfile');
const app = express();
const { setUp: setUpContractsRoutes } = require('./contracts/routes');
const { setUp: setUpJobsRoutes } = require('./jobs/routes');
const { setUp: setUpAdminRoutes } = require('./admin/routes');

app.use(bodyParser.json());
app.set('sequelize', sequelize);
app.set('models', sequelize.models);
app.use(getProfile);

const router = express.Router();
setUpContractsRoutes(router);
setUpJobsRoutes(router);
setUpAdminRoutes(router);

app.use('/', router);

app.get('/profile', async (req, res) => {
  const { Profile } = req.app.get('models');
  const profile = await Profile.findOne({
    where: {
      id: req.profile.id,
    },
  });
  res.json(profile);
});

module.exports = app;
