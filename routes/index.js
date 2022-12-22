const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const secretKey = "**********";

router.get("/", (req, res, next) => {
    res.render("index", { title: "Swagger UI" });
});

router.get("/countries", (req, res, next) => {
    let arrayCountries = [];
    req.db
        .from("data")
        .select("country")
        .distinct()
        .orderBy("country", "asc")
        .then((rows) => {
            rows.map((eachRow) => {
                arrayCountries.push(eachRow["country"]);
            });
        })
        .then(() => res.status(200).json(arrayCountries))
        .catch(() => {
            res.status(400).json({
                error: true,
                message: "Invalid query parameters. Query parameters are not permitted."
            });
        });
});

const searchVolcanoes = (req, res, population) => {
    if (population === null) {
        req.db
            .from("data")
            .select("id", "name", "country", "region", "subregion")
            .where("country", "=", req.query.country)
            .then((data) => res.status(200).json(data))
            .catch(() => {
                res.status(500).json({
                    error: true,
                    message: "Error in MySQL query",
                });
            });
    } else {
        req.db
            .from("data")
            .select("id", "name", "country", "region", "subregion")
            .where("country", "=", req.query.country)
            .andWhere(population, ">", 0)
            .then((data) => res.status(200).json(data))
            .catch(() => {
                res.status(500).json({
                    error: true,
                    message: "Error in MySQL query",
                });
            });
    }
};
router.get("/volcanoes", (req, res, next) => {
    let populationQuery = "";
    let population = "";
    let isQueryValid = true;

    // Check if the URL includes invalid query parameter
    for (each in req.query) {
        if (each !== "country") {
            if (each !== "populatedWithin") {
                isQueryValid = false;
            }
        }
    }

    if (isQueryValid === false) {
        // When the URL includes invalid query parameter
        res.status(400).json({
            error: true,
            message: "Country is a required query parameter.",
        });
    } else {
        if ("populatedWithin" in req.query) {
            populationQuery = req.query.populatedWithin;
            switch (populationQuery) {
                case "5km":
                    population = "population_5km";
                    searchVolcanoes(req, res, population);
                    break;

                case "10km":
                    population = "population_10km";
                    searchVolcanoes(req, res, population);
                    break;

                case "30km":
                    population = "population_30km";
                    searchVolcanoes(req, res, population);
                    break;

                case "100km":
                    population = "population_100km";
                    searchVolcanoes(req, res, population);
                    break;

                default:
                    // When the URL includes invalid populatedWithin query
                    res.status(400).json({
                        error: true,
                        message: "Invalid populatedWithin query.",
                    });
                    break;
            }
        } else if ("country" in req.query) {
            population = null;
            searchVolcanoes(req, res, population);
        } else {
            // When the URL includes no query parameters
            res.status(400).json({
                error: true,
                message: "No query parameters.",
            });
        }
    }
});

const getVolcanoData = (req, res, isAuthorized) => {
    req.db
        .from("data")
        .select("id")
        .then((data) => {
            for (let i = 1; i <= data.length; i++) {
                if (String(i) === req.params.id) {
                    return true;
                }
            }
            return false;
        })
        .then((idExists) => {
            console.log(idExists);
            if (idExists === false) {
                res.status(404).json({
                    error: true,
                    message: `Volcano with ID: ${req.params.id} not found.`,
                });
                return;
            } else {
                if (isAuthorized === false) {
                    req.db
                        .from("data")
                        .select(
                            "id",
                            "name",
                            "country",
                            "region",
                            "subregion",
                            "last_eruption",
                            "summit",
                            "elevation",
                            "latitude",
                            "longitude"
                        )
                        .where("id", "=", req.params.id)
                        .then((data) => {
                            res.status(200).json(data[0]);
                            return;
                        })
                        .catch(() => {
                            res.status(404).json({
                                error: true,
                                message: `Volcano with ID: ${req.params.id} not found.`,
                            });
                            return;
                        });
                } else {
                    req.db
                        .from("data")
                        .select(
                            "id",
                            "name",
                            "country",
                            "region",
                            "subregion",
                            "last_eruption",
                            "summit",
                            "elevation",
                            "latitude",
                            "longitude",
                            "population_5km",
                            "population_10km",
                            "population_30km",
                            "population_100km"
                        )
                        .where("id", "=", req.params.id)
                        .then((data) => {
                            res.status(200).json(data[0]);
                            return;
                        })
                        .catch(() => {
                            res.status(404).json({
                                error: true,
                                message: `Volcano with ID: ${req.params.id} not found.`,
                            });
                        });
                    return;
                }
            }
        });
};

router.get("/volcano/:id", (req, res, next) => {
    const auth = req.headers.authorization;
    let isAuthorized = true;
    if (auth === undefined) {
        isAuthorized = false;
        getVolcanoData(req, res, isAuthorized);
    } else if (auth.split(" ").length !== 2) {
        res.status(401).json({
            error: true,
            message: "Authorization header is malformed",
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
                isAuthorized = true;
                getVolcanoData(req, res, isAuthorized);
            }
        } catch (e) {
            res.status(401).json({
                error: true,
                message: "Invalid JWT token",
            });
        }
    }
});

router.get("/me", (req, res, next) => {
    res.status(200).json({
        name: "Tsubasa Endo",
        student_number: "n10724681",
    });
});

module.exports = router;
