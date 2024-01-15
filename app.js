const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDatabaseAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(4000, () => {
      console.log("server is running at server 4000");
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

initializeDatabaseAndServer();

const convertStateToResponseOb = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictToResponseDb = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

function authenticateToken(req, res, next) {
  let jwtToken;
  const authHeader = req.header("authorization");
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken !== undefined) {
    res.status(400);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MT_SEC", async (error, payload) => {
      if (error) {
        res.status(400);
        res.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.get("/test", async (req, res) => {
  res.status(202).send("Its working");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const selectQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectQuery);
  if (databaseUser === undefined) {
    res.status(400);
    res.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MT_SEC");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid Password");
    }
  }
});

app.get("/states/", authenticateToken, async (req, res) => {
  const getStateQuery = `SELECT * FROM state;`;
  const stateArray = await db.all(getStateQuery);
  res.send(stateArray.map((eachState) => convertStateToResponseOb(eachState)));
});

app.get("/states/:stateId/", authenticateToken, async (req, res) => {
  const { stateId } = req.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id='${stateId}';`;
  const state = await db.get(getStateQuery);
  res.send(convertStateToResponseOb(state));
});

app.get("/districts/:districtId/", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const getDistrictQuery = `SELECT * FROM district WHERE district_id = '${districtId}';`;
  const district = await db.get(getDistrictQuery);
  res.send(convertDistrictToResponseDb(district));
});

app.post("/districts", authenticateToken, async (req, res) => {
  const { stateId, districtName, cases, cured, active, deaths } = req.body;
  const postDistrictQuery = `
    INSERT INTO
        district(state_id, district_name, cases, cured, active, deaths)
    VALUES
        ('${stateId}', '${districtName}', '${cases}', '${cured}', '${active}', '${deaths}')
    `;
  await db.run(postDistrictQuery);
  res.send("District Successfully Added");
});

app.delete("/districts/:districtId/", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const deleteQuery = `
    DELETE FROM
        district
    WHERE
        district_id = '${districtId}'
    `;
  await db.run(deleteQuery);
  res.send("District Removed");
});

app.put("/district/:districtId/", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const updateQuery = `
    UPDATE
        district
    SET
        district_name= '${districtName}',
        state_id= '${stateId}',
        cases:'${cases}'
        cured:'${cured}'
        active:'${active}'
        deaths:'${deaths}'
    WHERE
        district_id= '${districtId}'
    `;
  await db.run(updateQuery);
  res.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authenticateToken, async (req, res) => {
  const { stateId } = req.params;
  const getStateStats = `
    SELECT
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
    FROM
        district
    WHERE
        state_id='${stateId}'
    `;
  const stats = await db.get(getStateStats);
  res.send({
    totalCases: stats["SUM(cases"],
    totalCured: stats["SUM(cured)"],
    totalActive: stats["SUM(active)"],
    totalDeaths: stats["SUM(deaths)"],
  });
});

module.exports = app;
