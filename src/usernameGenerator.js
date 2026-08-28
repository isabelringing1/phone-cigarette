import {
  FIRST_NAMES,
  NOUNS,
  SURNAMES,
  USERNAME_EMOJIS,
} from './usernameData.js'

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

function pick(items, random) {
  return items[Math.floor(random() * items.length)]
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function randomLetters(random) {
  const length = 7 + Math.floor(random() * 6)
  return Array.from({ length }, () => pick(LETTERS, random)).join('')
}

function firstNameOnly(random) {
  const firstName = pick(FIRST_NAMES, random)
  const style = Math.floor(random() * 4)

  if (style === 0) return capitalize(firstName)
  if (style === 1) {
    const repeatCount = 1 + Math.floor(random() * 2)
    return firstName + firstName.at(-1).repeat(repeatCount)
  }

  const emoji = pick(USERNAME_EMOJIS, random)
  return `${style === 3 ? capitalize(firstName) : firstName} ${emoji}`
}

function initialSurnameNumber(random) {
  const initial = pick(FIRST_NAMES, random).charAt(0)
  const surname = pick(SURNAMES, random)
  const number = 2 + Math.floor(random() * 19)
  const formattedNumber = number < 10 && random() < 0.5
    ? `0${number}`
    : String(number)

  return `${initial}${surname}${formattedNumber}`
}

function nounCombination(random) {
  const firstIndex = Math.floor(random() * NOUNS.length)
  let secondIndex = Math.floor(random() * (NOUNS.length - 1))
  if (secondIndex >= firstIndex) secondIndex += 1

  const words = `${NOUNS[firstIndex]} ${NOUNS[secondIndex]}`
  return random() < 0.75
    ? words.toUpperCase()
    : words.split(' ').map(capitalize).join(' ')
}

export function generateUsername(random = Math.random) {
  const typeRoll = random()

  if (typeRoll < 0.2) {
    return `${capitalize(pick(FIRST_NAMES, random))} ${capitalize(pick(SURNAMES, random))}`
  }
  if (typeRoll < 0.6) return firstNameOnly(random)
  if (typeRoll < 0.75) return initialSurnameNumber(random)
  if (typeRoll < 0.8) return randomLetters(random)
  return nounCombination(random)
}

export function generatePageUsername() {
  return generateUsername()
}
