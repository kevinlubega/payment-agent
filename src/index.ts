// Local development entry point — not used by Vercel
import app from "./app";

const PORT = process.env.PORT ?? 4000;

app.listen(PORT, () => {
  console.log(`Payment agent running on http://localhost:${PORT}`);
});
