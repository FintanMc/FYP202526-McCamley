import express from 'express';
import path from 'path';

process.loadEnvFile(path.resolve(process.cwd(), '../.env'));
const app = express();
const port = process.env.SERVER_PORT || 3000;

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