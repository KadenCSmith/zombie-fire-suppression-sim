import {createRequire} from 'node:module'
import {describe,it,expect} from 'vitest'
const {parseByteRange}=createRequire(import.meta.url)('../electron/http-range.cjs')
describe('local film seeking',()=>{
 it('supports full, bounded, open-ended and suffix requests',()=>{
  expect(parseByteRange(undefined,100)).toBeNull()
  expect(parseByteRange('bytes=10-29',100)).toEqual({start:10,end:29,length:20})
  expect(parseByteRange('bytes=99-',100)).toEqual({start:99,end:99,length:1})
  expect(parseByteRange('bytes=-20',100)).toEqual({start:80,end:99,length:20})
  expect(parseByteRange('bytes=80-200',100)).toEqual({start:80,end:99,length:20})
  expect(parseByteRange('bytes=-200',100)).toEqual({start:0,end:99,length:100})
 })
 it('rejects malformed, multipart, unsafe and unsatisfiable requests',()=>{
  for(const value of ['items=0-1','bytes=-','bytes=-0','bytes=100-','bytes=8-2','bytes=0-1,5-8','bytes=9007199254740992-'])expect(()=>parseByteRange(value,100)).toThrow(RangeError)
  expect(()=>parseByteRange('bytes=0-',0)).toThrow(RangeError)
 })
})
