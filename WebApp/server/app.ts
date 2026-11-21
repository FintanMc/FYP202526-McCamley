import express from 'express';
import path from 'path';

const app = express();
const port = 3030;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", (req, res) => {
  res.send({ message: "Hello from the API!" });
});

app.use(express.static('public'));

const server = app.listen(port, (err) => {
  if (err) {
    console.error(`Error starting server: ${err}`);
    return;
  }
  console.log(`Server is running on http://localhost:${port}`);
});