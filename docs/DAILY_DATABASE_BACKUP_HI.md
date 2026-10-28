# Daily encrypted database backup

**Daily backup schedule enabled hai.** Repository owner ne dono GitHub secrets
add kar diye. 28 October 2026 ka [pehla manual workflow run](https://github.com/wcdsupport01-sys/wellcardeals/actions/runs/40653635130)
successful hua aur encrypted artifact GitHub par save hua. Koi paid plan upgrade
nahi kiya gaya.

Usi uploaded file ko download karke saved recovery key se authenticate/decrypt
kiya aur disposable PostgreSQL 17 mein restore verify kiya: **33 public tables,
3 account tables aur 37,813 imported vehicle records**. Exact content
fingerprints, account generated fields, foreign keys aur sequence values pass
hain. Snapshot mein 31 cars, 9 bids aur 16 profiles hain; archive lagbhag 10.6 MB
hai. Check ke baad temporary decrypted file aur container remove kar diye.

Schedule roz **02:00 IST** hai; pehla verified run manual tha. Neeche future
setup/token rotation aur recovery ke reference steps hain.

## 1. Read-only backup token

Supabase → Account → Access Tokens → Generate new token:

- Name: `wellcardeals-daily-backup`
- Expiry: `90 days`; expiry se pehle replace karein.
- Resource access: Project
- Organization: `shivam wcd back end`
- Project: `vanshgupta12b's Project` (`zdbtlwdjmpvcmwsnkopc`)
- Sirf **Database → Database → Read**. Baaki permissions `None`.

Token ko copy karke seedha GitHub secret ki value mein paste karein.
Temporary 24-hour deployment token daily backup ke liye suitable nahi hai.

## 2. GitHub mein do secrets

[Repository Actions secrets settings](https://github.com/wcdsupport01-sys/wellcardeals/settings/secrets/actions)
mein **New repository secret** se ye dono add karein:

| Name | Value |
|---|---|
| `WCD_BACKUP_READ_TOKEN` | Upar generate kiya hua project-scoped read-only token |
| `WCD_BACKUP_ENCRYPTION_KEY` | Setup ki private key file ke andar ki poori 64-character value |

Encryption key ki independent safe copy rakhein: key kho gayi to encrypted
backups decrypt nahi honge. Key, token aur decrypted backup ko chat/Git mein
paste na karein. Purane archives ke liye purani key bhi rakhni hogi.

## 3. Workflow run aur schedule

Repository → **Actions → Encrypted database backup → Run workflow → main**.
`Export, verify and encrypt database` aur `Retain encrypted snapshot` dono green
hone chahiye. Run ke Artifacts mein `.wcdbackup` file milti hai.

Active workflow [yahan](../.github/workflows/database-backup.yml) publish ho gaya hai.

Schedule roz **02:00 IST** hai; GitHub scheduled runs delay ho sakte hain.
Encrypted artifacts **14 din** retain hote hain. Public repositories mein
60 din repository activity na hone par GitHub scheduled workflows disable kar
sakta hai; Actions status monitor karein aur zarurat par enable karein. Token
rotation aur failed-run notices bhi maintain karein. Provider bandwidth/artifact
quotas apply hote hain; current archive size par 14 snapshots lagbhag 148 MB hain.

## Kya backup hota hai

- Application schema, functions/triggers/RLS/grants, table data aur sequence values.
- Account users/password hashes, identities aur MFA factor records, encrypted form mein.
- Storage bucket settings aur object metadata/inventory.
- Business/account tables ek consistent database statement snapshot se; bade
  imported catalog ki har page aur end-to-end fingerprint verify hoti hai.

Photo/PDF/video **file bytes**, active Auth session/refresh-token tables aur
provider/platform secrets is database archive mein nahi aate. Media files aur
platform configuration ke independent backups alag chahiye. Yeh full project
SLA/disaster-recovery service nahi hai.

Repository public hai. Workflow sirf AES-256-GCM encrypted `.wcdbackup` upload
karta hai; raw data aur keys source control/artifact mein nahi jaate. Failed
export, changed catalog ya incomplete page par archive publish nahi hota.

## Private recovery check

Node 24 aur key ki safe local copy ke saath:

```sh
node scripts/backup/decrypt.mjs snapshot.wcdbackup private-restore.jsonl /private/path/key.txt
node scripts/backup/inspect.mjs private-restore.jsonl
```

Decrypted file private rakhein aur recovery ke baad remove karein. Restore ko
pehle isolated PostgreSQL/Supabase test environment par validate karein;
production tables ko overwrite karne se pehle schema/version aur business state
review zaroori hai. Inspect command records ki contents print nahi karta.

Tests:

```sh
node --test tests/backup-crypto.test.mjs tests/backup-create.test.mjs
```

Eight tests encryption/authentication, altered/wrong-key rejection, failed-export
cleanup, existing archive protection, exact int64 preservation, >1,000-row export,
API caps/denial aur source changes cover karte hain.
