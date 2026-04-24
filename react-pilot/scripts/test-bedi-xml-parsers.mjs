#!/usr/bin/env node
/**
 * Fast checks for BEDI XML helpers (no full `verify-pilot` suite).
 * Run: `node scripts/test-bedi-xml-parsers.mjs` or `npm run test:bedi`.
 */
import assert from 'node:assert/strict'
import { DOMParser } from '@xmldom/xmldom'

import { parseXml, extractMdKeywordsTextHrefPairs, listMiMetadataDirectChildren } from '../src/profiles/bedi/bediXmlUtils.js'

globalThis.DOMParser = DOMParser

const probeDoc = new DOMParser().parseFromString('<root><child/></root>', 'application/xml')
const elementProto = Object.getPrototypeOf(probeDoc.documentElement)
if (!Object.getOwnPropertyDescriptor(elementProto, 'children')) {
  Object.defineProperty(elementProto, 'children', {
    configurable: true,
    enumerable: true,
    get() {
      return Array.from(this.childNodes || []).filter((n) => n && n.nodeType === 1)
    },
  })
}

const kwXml = `<?xml version="1.0"?>
<gmd:MD_Keywords xmlns:gmd="http://www.isotc211.org/2005/gmd"
  xmlns:gco="http://www.isotc211.org/2005/gco"
  xmlns:gmx="http://www.isotc211.org/2005/gmx"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <gmd:keyword>
    <gmx:Anchor xlink:href="https://example.org/concept/a" xlink:title="Alpha">Alpha</gmx:Anchor>
  </gmd:keyword>
  <gmd:keyword>
    <gco:CharacterString>Beta</gco:CharacterString>
  </gmd:keyword>
</gmd:MD_Keywords>`

const metaXml = `<?xml version="1.0"?>
<gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi"
  xmlns:gmd="http://www.isotc211.org/2005/gmd"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <gmd:contact xlink:href="https://docucomp.example/contact"/>
</gmi:MI_Metadata>`

const parsedKw = parseXml(kwXml)
assert.ok(parsedKw.ok, parsedKw.error)
const kwBlock = parsedKw.doc.getElementsByTagName('gmd:MD_Keywords')[0]
const pairs = extractMdKeywordsTextHrefPairs(kwBlock)
assert.deepEqual(pairs.labels, ['Alpha', 'Beta'])
assert.equal(pairs.hrefs[0], 'https://example.org/concept/a')
assert.equal(pairs.hrefs[1], '')

const parsedMeta = parseXml(metaXml)
assert.ok(parsedMeta.ok, parsedMeta.error)
const contacts = listMiMetadataDirectChildren(parsedMeta.doc, 'contact')
assert.equal(contacts.length, 1)
assert.equal(contacts[0].getAttribute('xlink:href'), 'https://docucomp.example/contact')

console.log('test-bedi-xml-parsers: ok')
