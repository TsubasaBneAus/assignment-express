const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const secretKey = "**********";

/* GET users listing. */
router.get("/", function (req, res, next) {
    res.send("respond with a resource");
});

router.post("/register", (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
        res.status(400).json({
            error: true,
            message: "Request body incomplete, both email and password are required",
        });
        return;
    }

    req.db
        .from("users")
        .select("*")
        .where("email", "=", email)
        .then((users) => {
            if (users.length > 0) {
                res.status(409).json({
                    error: true,
                    message: "User already exists",
                });
                return;
            }

            const hash = bcrypt.hashSync(password, 10);

            req.db
                .from("users")
                .insert({ email: email, hash: hash })
                .then(() => {
                    res.status(201).json({
                        error: false,
                        message: "User created",
                    });
                })
                .catch(() => {
                    res.status(500).json({
                        error: true,
                        message: "Error in MySQL query",
                    });
                });
        });
});

router.post("/login", (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;
    if (!email || !password) {
        res.status(400).json({
            error: true,
            message: "Request body incomplete, both email and password are required",
        });
        return;
    }

    req.db
        .from("users")
        .select("*")
        .where("email", "=", email)
        .then((users) => {
            if (users.length === 0) {
                res.status(401).json({
                    error: true,
                    message: "User not registered",
                });
                return;
            }

            const hash = users[0].hash;
            if (!bcrypt.compareSync(password, hash)) {
                res.status(401).json({
                    error: true,
                    message: "Incorrect password",
                });
                return;
            }

            const expires_in = 60 * 60 * 24;
            const exp = Date.now() + expires_in * 1000;
            const token = jwt.sign({ email, exp }, secretKey);

            res.status(200).json({
                token,
                token_type: "Bearer",
                expires_in,
            });
        })
        .catch(() => {
            res.status(500).json({
                error: true,
                message: "Error in MySQL query",
            });
        });
});

router.get("/:email/profile", (req, res, next) => {
    const auth = req.headers.authorization;
    let isAuthorized = true;
    if (auth === undefined) {
        isAuthorized = false;
    } else if (auth.split(" ").length !== 2) {
        res.status(401).json({
            error: true,
            message: "Missing or malformed JWT",
        });
    } else {
        const token = auth.split(" ")[1];
        try {
            const payload = jwt.verify(token, secretKey);
            if (Date.now() > payload.exp) {
                res.status(401).json({
                    error: true,
                    message: "JWT token has expired",
                });
            } else {
                if (payload.email === req.params.email) {
                    isAuthorized = true;
                } else {
                    isAuthorized = false;
                }
            }
        } catch (e) {
            res.status(401).json({
                error: true,
                message: "Invalid JWT",
            });
        }
    }

    if (isAuthorized === false) {
        req.db
            .from("users")
            .select("email", "firstName", "lastName")
            .where("email", "=", req.params.email)
            .then((data) => {
                if (data.length === 0) {
                    res.status(404).json({
                        error: true,
                        message: "User not found"
                    });
                } else {
                    res.status(200).json(data[0]);
                }
            })
            .catch(() => {
                res.status(404).json({
                    error: true,
                    message: "User not found",
                });
            });
    } else {
        req.db
            .from("users")
            .select("*")
            .where("email", "=", req.params.email)
            .then((data) => {
                if (data.length === 0) {
                    res.status(404).json({
                        error: true,
                        message: "User not found"
                    });
                } else if (data[0].email !== req.params.email) {
                    res.status(200).json({
                        email: data[0].email,
                        firstName: data[0].firstName,
                        lastName: data[0].lastName,
                    });
                } else {
                    res.status(200).json(data[0]);
                }
            })
            .catch(() => {
                res.status(404).json({
                    error: true,
                    message: "User not found",
                });
            });
    }
});

const updateProfile = (req, res) => {
    const date = req.body.dob;
    const pattern1 = /^\d{4}-\d{2}-\d{2}$/;
    const year1 = date.split("-")[0];
    const month1 = String(date.split("-")[1] - 1);
    const day1 = date.split("-")[2];
    const dateObject1 = new Date(year1, month1, day1);
    const year2 = dateObject1.getFullYear();
    const month2 = dateObject1.getMonth();
    const day2 = dateObject1.getDate();
    const dateObject2 = new Date();
    const dateComparison = dateObject1 > dateObject2;

    if (
        !req.body.firstName ||
        !req.body.lastName ||
        !req.body.dob ||
        !req.body.address
    ) {
        res.status(400).json({
            error: true,
            message:
                "Request body incomplete: firstName, lastName, dob and address are required.",
        });
        return;
    } else if (
        typeof req.body.firstName !== typeof "" ||
        typeof req.body.lastName !== typeof "" ||
        typeof req.body.address !== typeof ""
    ) {
        res.status(400).json({
            error: true,
            message:
                "Request body invalid: firstName, lastName and address must be strings only.",
        });
        return;
    } else if (
        date.match(pattern1) === null ||
        year1 !== String(year2) ||
        month1 !== String(month2) ||
        day1 !== String(day2)
    ) {
        res.status(400).json({
            error: true,
            message:
                "Invalid input: dob must be a real date in format YYYY-MM-DD.",
        });
        return;
    } else if (dateComparison === true) {
        res.status(400).json({
            error: true,
            message: "Invalid input: dob must be a date in the past.",
        });
        return;
    } else {
        const pop = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            dob: req.body.dob,
            address: req.body.address,
        };
        req.db
            .from("users")
            .where("email", "=", req.params.email)
            .update(pop)
            .then(() => {
                req.db
                    .from("users")
                    .where("email", "=", req.params.email)
                    .select("email", "firstName", "lastName", "dob", "address")
                    .then((data) => {
                        res.status(200).json(data[0]);
                        return;
                    })
                    .catch(() => {
                        res.status(500).json({
                            error: true,
                            message: "Error in MySQL query",
                        });
                        return;
                    });
            });
    }
};

router.put("/:email/profile", (req, res, next) => {
    const auth = req.headers.authorization;
    const givenEmail = req.params.email;
    if (auth === undefined) {
        res.status(401).json({
            error: true,
            message: "Unauthenticated user",
        });
    } else if (auth.split(" ").length !== 2) {
        res.status(401).json({
            error: true,
            message: "Missing or malformed JWT",
        });
    } else {
        const token = auth.split(" ")[1];
        try {
            const payload = jwt.verify(token, secretKey);
            if (Date.now() > payload.exp) {
                res.status(401).json({
                    error: true,
                    message: "JWT token has expired",
                });
            } else {
                if (payload.email === givenEmail) {
                    if (JSON.stringify(req.body) == "{}") {
                        res.status(400).json({
                            error: true,
                            message:
                                "Request body incomplete: firstName, lastName, dob and address are required.",
                        });
                    } else {
                        updateProfile(req, res);
                    }
                } else {
                    res.status(403).json({
                        error: true,
                        message: "Forbidden",
                    });
                }
            }
        } catch (e) {
            res.status(401).json({
                error: true,
                message: "Invalid JWT",
            });
        }
    }
});

module.exports = router;
