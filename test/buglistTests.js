#!/usr/bin/env node

'use strict'

const util = require('util')
const exec = util.promisify(require('child_process').exec)
const mktemp = require('mktemp')
const download = require('download')
const JSONPath = require('JSONPath')
const fs = require('fs')
const bugs = JSON.parse(fs.readFileSync(__dirname + '/../docs/bugs.json', 'utf8'))

const bugsByName = {}
for (const i in bugs) {
  if (bugs[i].name in bugsByName) {
    throw 'Duplicate bug name: ' + bugs[i].name
  }
  bugsByName[bugs[i].name] = bugs[i]
}

const tests = fs.readFileSync(__dirname + '/buglist_test_vectors.md', 'utf8')

const testVectorParser = /\s*#\s+(\S+)\s+## buggy\n([^#]*)## fine\n([^#]*)/g

runTests()

async function runTests () {
  let result
  while ((result = testVectorParser.exec(tests)) !== null) {
    const name = result[1]
    const buggy = result[2].split('\n--\n')
    const fine = result[3].split('\n--\n')
    console.log('Testing ' + name + ' with ' + buggy.length + ' buggy and ' + fine.length + ' fine instances')

    try {
      await checkRegex(name, buggy, fine)
      await checkJSONPath(name, buggy, fine)
    } catch (err) {
      console.error('Error: ' + err)
    }
  }
}

function checkRegex (name, buggy, fine) {
  return new Promise(function (resolve, reject) {
    const regexStr = bugsByName[name].check['regex-source']
    if (regexStr !== undefined) {
      const regex = RegExp(regexStr)
      for (var i in buggy) {
        if (!regex.exec(buggy[i])) {
          reject('Bug ' + name + ': Buggy source does not match: ' + buggy[i])
        }
      }
      for (var i in fine) {
        if (regex.exec(fine[i])) {
          reject('Bug ' + name + ': Non-buggy source matches: ' + fine[i])
        }
      }
    }
    resolve()
  })
}

async function checkJSONPath (name, buggy, fine) {
  const jsonPath = bugsByName[name].check['ast-compact-json-path']
  if (jsonPath !== undefined) {
    const url = 'http://github.com/ethereum/solidity/releases/download/v' + bugsByName[name].introduced + '/solc-static-linux'
    try {
      const tmpdir = await mktemp.createDir('XXXXX')
      const binary = tmpdir + '/solc-static-linux'
      await download(url, tmpdir)
      exec('chmod +x ' + binary)
      for (var i in buggy) {
        var result = await checkJsonPathTest(buggy[i], tmpdir, binary, jsonPath, i)
        if (!result) { throw 'Bug ' + name + ': Buggy source does not contain path: ' + buggy[i] }
      }
      for (var i in fine) {
        var result = await checkJsonPathTest(fine[i], tmpdir, binary, jsonPath, i + buggy.length)
        if (result) { throw 'Bug ' + name + ': Non-buggy source contains path: ' + fine[i] }
      }
      exec('rm -r ' + tmpdir)
    } catch (err) {
      throw err
    }
  }
}

function checkJsonPathTest (code, tmpdir, binary, query, idx) {
  return new Promise(function (resolve, reject) {
    const solFile = tmpdir + '/jsonPath' + idx + '.sol'
    const astFile = tmpdir + '/ast' + idx + '.json'
    writeFilePromise(solFile, code)
      .then(() => {
        return exec(binary + ' --ast-compact-json ' + solFile + ' > ' + astFile)
      })
      .then(() => {
        const jsonRE = /(\{[\s\S]*\})/
        const ast = JSON.parse(jsonRE.exec(fs.readFileSync(astFile, 'utf8'))[0])
        const result = JSONPath({ json: ast, path: query })
        if (result.length > 0) { resolve(true) } else { resolve(false) }
      })
      .catch((err) => {
        reject(err)
      })
  })
}

function writeFilePromise (filename, data) {
  return new Promise(function (resolve, reject) {
    fs.writeFile(filename, data, 'utf8', function (err) {
      if (err) reject(err)
      else resolve(data)
    })
  })
}
