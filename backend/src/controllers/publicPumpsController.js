const { pumps } = require("../data/store");

function listPumps(_req, res) {
  return res.status(200).json({
    success: true,
    data: pumps,
  });
}

module.exports = {
  listPumps,
};
