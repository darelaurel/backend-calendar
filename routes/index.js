const { Router } = require("express");
const zoomApiRoutes = require("./zoomApiRoutes");
const authApiRoutes = require("./authApiRoutes");

const router = new Router();

router.use("/zoom", zoomApiRoutes);
router.use("/auth", authApiRoutes);

module.exports = router;