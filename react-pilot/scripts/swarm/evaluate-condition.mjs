import { evaluateCondition } from './_condition.mjs'

const sampleCondition = {
  and: [
    { eq: ['record.type', 'granule'] },
    { missing: ['extent.vertical.min'] },
    { missing: ['extent.vertical.max'] },
  ],
}

const sampleContext = {
  record: { type: 'granule' },
  extent: { vertical: { min: '', max: '' } },
}

const result = evaluateCondition(sampleCondition, sampleContext)
console.log(JSON.stringify({ condition: sampleCondition, context: sampleContext, result }, null, 2))

