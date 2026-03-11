export const handleDiscordLogin = () => {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(window.location.origin + '/auth/discord/callback');
  const scope = 'identify guilds';
  
  const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  
  window.location.href = discordUrl;
};
