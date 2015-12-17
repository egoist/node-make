import babel from 'babel-core'
import requireFromString from 'require-from-string'
import fs from 'fs'
import {
  joinCurrentDir,
  stripCommentsInTask,
  parseTaskName,
  generateTaskFn
} from './helpers'
import walk from './walk'

const RE_MATCH_TASKS = /(\r?\n){2,}/
const RE_MATCH_LINES = /\r?\n{1,}/
const RE_MATCH_INTRO = /^([a-zA-Z0-9\@\.\_\-]+)\:\s*([a-zA-Z0-9\.\/]*)/
const RE_MATCH_IMPORT_INTRO = /^\@import\:\s*/

const transformOptions = {
  blacklist: ['regenerator'],
  optional: ['asyncToGenerator', 'runtime'],
  loose: ['es6.modules']
}

export default function parser (string) {
  if (typeof string !== 'string') {
    throw new Error('Input is not string!')
  }
  string = string.split(RE_MATCH_TASKS).filter(s => !!s.replace(/\s/g, ''))
  //strip comments
  string = string.map(task => {
    return stripCommentsInTask(task)
  })
  for (let [i, s] of string.entries()) {
    let lines = s.split(RE_MATCH_LINES).filter(line => !!line.replace(/\s/g, ''))
    let intro = lines[0]
    if (RE_MATCH_IMPORT_INTRO.test(intro)) {
      lines.shift(0)
      string[i] = lines.join('\n')
    } else if (RE_MATCH_INTRO.test(intro)) {
      let [, taskName, externalFile] = intro.match(RE_MATCH_INTRO)
      if (externalFile) {
        let tempLines = []
        lines.forEach(intro => {
          let [, taskName, externalFile] = intro.match(RE_MATCH_INTRO)
          let taskContent = fs.readFileSync(joinCurrentDir(externalFile), 'utf8')
          taskContent = stripCommentsInTask(taskContent)
          taskContent = taskContent.split(RE_MATCH_LINES).filter(line => !!line.replace(/\s+/g, ''))
          taskContent = walk(taskContent).join('\n')
          taskName = parseTaskName(taskName)
          tempLines.push(generateTaskFn(taskName, taskContent))
        })
        lines = tempLines.join('\n')
      } else {
        // match taskName, externalFile from line one
        // prepend to function heading
        taskName = parseTaskName(taskName)
        lines[0] = generateTaskFn(taskName)
        // append `}` to function ending
        lines.push('}')
        lines = walk(lines)
        lines = lines.join('\n')
      }
      string[i] = lines
    }
  }
  const { code } = babel.transform(string.join('\n\n'), transformOptions)
  return requireFromString(code)
}
