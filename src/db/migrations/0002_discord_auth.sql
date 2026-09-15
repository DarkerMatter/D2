-- discord oauth. passwords are dead. long live oauth.
ALTER TABLE users ADD COLUMN discord_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN discord_username TEXT;
ALTER TABLE users ADD COLUMN discord_avatar TEXT;

-- nuke the old password-based admin account. they'll re-register through discord.
DELETE FROM users;
