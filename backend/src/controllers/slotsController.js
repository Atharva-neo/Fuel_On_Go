const { pumps, slotsByPump } = require("../data/store");

function getSlots(req, res, next) {
  try {
    const { pumpId } = req.params;
    const pump = pumps.find((item) => item.id === pumpId);

    if (!pump) {
      return res.status(404).json({
        success: false,
        error: "Pump not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: slotsByPump[pumpId] || [],
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getSlots,
};
