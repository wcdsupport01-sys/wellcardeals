// Offline recovery helper. The authenticated plaintext is private and never logged.
import {readFile} from 'node:fs/promises';
import {backupKey,decryptBackup} from './crypto.mjs';
const [input,output,keyFile]=process.argv.slice(2);
if(!input||!output)throw new Error('Usage: node scripts/backup/decrypt.mjs ENCRYPTED_FILE PRIVATE_OUTPUT [KEY_FILE]');
const key=backupKey(keyFile?await readFile(keyFile,'utf8'):process.env.WCD_BACKUP_ENCRYPTION_KEY);
await decryptBackup(input,output,key);
console.log('Backup authenticated and decrypted into the requested private output file.');
