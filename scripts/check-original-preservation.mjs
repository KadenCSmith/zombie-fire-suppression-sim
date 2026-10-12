import fs from 'node:fs'
import crypto from 'node:crypto'
const record=JSON.parse(fs.readFileSync(new URL('../docs/review/version21/original-preservation.json',import.meta.url),'utf8'))
const root=new URL('../',import.meta.url)
const mismatches=record.protectedFiles.filter(({path,sha256})=>crypto.createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex')!==sha256).map(v=>v.path)
if(mismatches.length){console.error('Original preservation FAILED:',mismatches);process.exitCode=1}
else console.log(`Original preservation PASS: ${record.protectedFiles.length} SHA-256 identities match ${record.originalCommit}`)
