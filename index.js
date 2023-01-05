#! /usr/bin/env node

const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const { snakeCase } = require('snake-case')

const filePaths = process.argv.slice(2)

const result = filePaths.map(filePath => {
  const filename = path.basename(filePath, path.extname(filePath))
  const fileDir = path.dirname(filePath)
  const jsObj = yaml.load(fs.readFileSync(filePath, 'utf8'))

  const finalJs = `
  ${Object.entries(jsObj).map(([key, val]) => `
  const ${key} = ${removeQuotesFromVal(removeQuotesFromKey(addPathsToValue(val)))}
  `).join('\n')}
 \n\n\n\n
  module.exports = ${removeQuotesFromVal(removeQuotesFromKey(addPathsToValue(jsObj)))}
  `
  const finalEnv = finalJs.match(/(?<=###).*(?=###)/gm).join('\n')

  fs.writeFileSync(`./${fileDir}/${filename}.env.example`, finalEnv)
  fs.writeFileSync(`./${fileDir}/${filename}.config.js`, finalJs.replace(/###.*###/gm, ''))

  const outputFiles = fs.readdirSync(fileDir).filter(f => f.startsWith(`${filename}.`))
  return { finalJs, finalEnv, outputFiles }
})

// console.dir({ result }, { depth: null })
console.log('\n\n')
console.log('Input files: ')
console.dir(process.argv.slice(2))
console.log('Output files: ')
console.dir(result.map(({ outputFiles }) => outputFiles))

function removeQuotesFromKey(obj) {
  const cleaned = JSON.stringify(obj, null, 2)

  return cleaned.replace(/^[\t ]*"[^:\n\r]+(?<!\\)":/gm, function (match) {
    return match.replace(/"/g, '')
  })
}

function removeQuotesFromVal(obj) {
  const cleaned = isObject(obj)
    ? JSON.stringify(obj, null, 2)
    : obj

  return cleaned.replace(/"process.env(.*?)"[,\n\r]/gm, function (match) {
    return match.replace(/"/g, '')
  })
}

function addPathsToValue(obj, parentKey = '') {
  if (Array.isArray(obj)) {
    return obj.map(el => addPathsToValue(el, parentKey))
  }

  if (isObject(obj)) {
    return Object.entries(obj).reduce((acc, [key, val]) => {
      const newKey = `${parentKey}_${key}`
      if (isObject(val)) {
        acc[key] = addPathsToValue(val, newKey)
      } else {
        const envKey = snakeCase(newKey).toUpperCase()
        acc[key] = `process.env.${envKey}###${envKey}='${val}'###`
      }
      return acc
    }, {})
  }

  return obj
}

function isObject(x) {
  return typeof x === 'object' && x !== null
};
