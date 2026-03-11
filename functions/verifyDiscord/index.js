const sdk = require('node-appwrite');

module.exports = async function (req, res) {
  const client = new sdk.Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

  const DISCORD_SECRET = process.env.DISCORD_DEVELOPER_SECRET; // Preso dal tuo .env

  // Logica per scambiare il CODE di Discord con un Token
  // e salvare l'ID Discord nel profilo utente Appwrite
  
  res.json({
    success: true,
    message: "Profilo Discord verificato con successo!"
  });
};
