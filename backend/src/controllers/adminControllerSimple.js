function login(req, res, next) {
  try {
    const { username, phone, password } = req.body || {};
    const loginId = username || phone;

    if (!loginId || !password) {
      return res.status(400).json({
        error: "username/phone and password are required",
      });
    }

    const validLogin = loginId === "admin" || loginId === "9999999999";
    const validPassword = password === "admin123";

    if (!validLogin || !validPassword) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      admin: {
        id: "A1",
        name: "Fuel on Go Admin",
        role: "admin",
      },
      token: "mock-admin-token",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
};
