import express from 'express';

const app  = express();
const port = 3001;


app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});


app.listen(port,() => {
    console.log(`Server is running on port ${port}`)
});

