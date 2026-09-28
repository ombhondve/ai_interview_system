const register = async (req, res) => {

    const { name, email, password } = req.body;

    console.log(name);
    console.log(email);
    console.log(password);

    res.status(201).json({
        message: "Admin registered successfully"
    });
};

module.exports = {
    register
};