import { findUserName } from './utils/findUserName'
import { elementsPaths, propsPaths } from './utils/elementPathsUserName'
import { verifiedUsers1Promise as loadUserList1, verifiedUsers2Promise as loadUserList2 } from './utils/loadUserList'
import { retrieveData } from './utils/retrieveNewData'
import {
  CLOWN,
  LOCAL_STORAGE,
  DEFAULT_CONFIG,
  VERIFIED_TYPE,
  BADGE_CLASS_TARGET,
  TWITTER_BLUE_BADGE,
  VERIFIED_BADGE
} from './constants'

let usersList1 = []
let usersList2 = []

loadUserList1.then((vUsersList1) => {
  usersList1 = vUsersList1
})

loadUserList2.then((vUsersList2) => {
  usersList2 = vUsersList2
})

let userBadgeColors = DEFAULT_CONFIG.badgeColors
let userOptions = DEFAULT_CONFIG.options

const localStorageConfig = localStorage.getItem(LOCAL_STORAGE)
if (localStorageConfig) {
  const currentUserConfig = retrieveData(JSON.parse(localStorageConfig))
  userBadgeColors = currentUserConfig.badgeColors
  userOptions = currentUserConfig.options
}

function getParentElementByLevel (element, parentLevel) {
  let parentTarget = element
  let level = 0
  while (level < parentLevel) {
    parentTarget = parentTarget.parentElement
    level++
  }
  return parentTarget
}

function findElementBadge (element) {
  if (BADGE_CLASS_TARGET === element.className) {
    const profileBadgeHeading = getParentElementByLevel(element, 6)

    if (profileBadgeHeading?.tagName !== 'H2') {
      handleVerificationStatus(element)
    }

    // Header title on a user's profile
    if (profileBadgeHeading?.tagName === 'H2') {
      handleVerificationStatus(element, { isViewingUserProfile: true })
    }

    // Username, below profile photo
    const profileBadgeUsername = getParentElementByLevel(element, 9)
    if (profileBadgeUsername?.dataset?.testid === 'UserName') {
      handleVerificationStatus(element, { isViewingUserProfile: true, isSecondBadgeProfile: true })
    }
  }

  // Checks for changes when switching between user profiles
  // e.g. user profile1 --> user profile 2
  // In this case MutationObserver doesn't detect changes for both badges
  // so you can't retrieve updated props of the user
  // UserProfileSchema-test act like a trigger at this moment.
  if (element?.dataset?.testid === 'UserProfileSchema-test' || element.dataset?.testid === 'UserDescription') {
    const badgeElements = document.querySelectorAll(`.${BADGE_CLASS_TARGET.replaceAll(' ', '.')}`)

    for (let i = 0; i < badgeElements.length; i++) {
      const profileHeadingPath = getParentElementByLevel(badgeElements[i], 6)
      if (profileHeadingPath?.tagName === 'H2') {
        // Header title on a user's profile
        handleVerificationStatus(badgeElements[i], { isViewingUserProfile: true })

        // username, below profile photo
        handleVerificationStatus(badgeElements[i + 1], { isViewingUserProfile: true, isSecondBadgeProfile: true })

        break
      }
    }
  }

  if (element.childNodes) {
    [...element.childNodes].forEach(findElementBadge)
  }
}

function handleVerificationStatus (element, elementOptions) {
  let elementProps
  if (elementOptions?.isSecondBadgeProfile) {
    elementProps = getMainReactProps(getParentElementByLevel(element, 6), element)
  } else {
    elementProps = getMainReactProps(getParentElementByLevel(element, 3), element)
  }

  if (elementProps === undefined) return

  if (elementOptions?.isViewingUserProfile && element.firstChild?.tagName === 'svg') {
    if (element.firstChild.id === VERIFIED_TYPE.LEGACY_VERIFIED) {
      element.removeChild(element.firstChild)
    }
  }

  const currentVerifiedType = elementProps.verifiedType
  const isBlueVerified = elementProps.isBlueVerified
  const isUserVerified = isUserLegacyVerified(element)

  if (isBlueVerified) {
    if (isUserVerified && userOptions.revokeLegacyVerifiedBadge === false) {
      createBadge(element, VERIFIED_TYPE.LEGACY_VERIFIED, userBadgeColors.verifiedAndWithTwitterBlue, currentVerifiedType)
    } else {
      createBadge(element, VERIFIED_TYPE.TWITTER_BLUE, userBadgeColors.twitterBlue, currentVerifiedType, elementOptions?.isViewingUserProfile)
    }
  } else {
    if (isUserVerified) createBadge(element, VERIFIED_TYPE.LEGACY_VERIFIED, userBadgeColors.verified, currentVerifiedType)
  }
}

function legacyUserExists (actualUser) {
  for (let index = 0; index < usersList1.length; index++) {
    if (usersList1[index].key === actualUser[0]) {
      if (findUserName(usersList1[index].users, actualUser) !== -1) {
        return true
      }
    }
  }

  for (let index = 0; index < usersList2.length; index++) {
    if (usersList2[index].key === actualUser[0]) {
      if (findUserName(usersList2[index].users, actualUser) !== -1) {
        return true
      }
    }
  }

  return false
}

function isUserLegacyVerified (element) {
  const posibleElementPaths = elementsPaths(element)
  for (let i = 0; i < posibleElementPaths.length; i++) {
    const elementProps = posibleElementPaths[i] && getReactProps(posibleElementPaths[i])
    const actualUser = propsPaths(elementProps)
    if (elementProps !== undefined && actualUser !== undefined) {
      if (legacyUserExists(actualUser)) {
        return true
      } else {
        return false
      }
    }
  }
  return false
}

function getReactProps (element) {
  const elementPropsNames = Object.getOwnPropertyNames(element)
  const reactPropsTarget = elementPropsNames.find(nameProp => nameProp.startsWith('__reactProps'))
  const reactProps = element[reactPropsTarget]
  return reactProps
}

// There is a special case for both two badges in a user profile
// svg element can't be eliminated, that trown a error when is switching between user profiles
// error: Something went wrong, but don’t fret — it’s not your fault.

function createBadge (element, userVerifiedStatus, badgeColor, currentVerifiedType, isViewingUserProfile) {
  let svgElementG = element
  while (svgElementG !== null && svgElementG.tagName !== 'g') {
    svgElementG = svgElementG.firstChild
  }

  if (svgElementG !== null && (currentVerifiedType === VERIFIED_TYPE.BUSINESS || currentVerifiedType === VERIFIED_TYPE.GOVERNMENT)) return

  if (userOptions.hideTwitterBlueBadge && userVerifiedStatus === VERIFIED_TYPE.TWITTER_BLUE) {
    if (svgElementG !== null) {
      if (!isViewingUserProfile) {
        const parentSvgElementG = svgElementG.parentElement.parentElement
        parentSvgElementG.removeChild(parentSvgElementG.firstChild)
        return
      } else {
        const parentSvgElementG = svgElementG.parentElement
        parentSvgElementG.removeChild(parentSvgElementG.firstChild)
        const gElement = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        parentSvgElementG.appendChild(gElement)
        return
      }
    } else {
      return
    }
  }

  let userVerificationBadge = TWITTER_BLUE_BADGE
  if (userVerifiedStatus === VERIFIED_TYPE.LEGACY_VERIFIED) {
    userVerificationBadge = VERIFIED_BADGE
  }
  const gElement = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  if (userOptions.replaceTBWithClown && userVerifiedStatus === VERIFIED_TYPE.TWITTER_BLUE) {
    gElement.innerHTML = CLOWN
  } else {
    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    pathElement.setAttribute('fill', badgeColor)
    pathElement.setAttribute('d', userVerificationBadge)
    gElement.appendChild(pathElement)
  }

  if (svgElementG !== null) {
    const parentElement = svgElementG.parentElement
    parentElement.removeChild(svgElementG)
    parentElement.appendChild(gElement)
  } else {
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svgElement.id = VERIFIED_TYPE.LEGACY_VERIFIED
    svgElement.setAttribute('viewBox', '0 0 22 22')
    svgElement.setAttribute('class', 'r-1cvl2hr r-4qtqp9 r-yyyyoo r-1xvli5t r-f9ja8p r-og9te1 r-bnwqim r-1plcrui r-lrvibr')

    svgElement.appendChild(gElement)
    element.appendChild(svgElement)
  }
}

// https://stackoverflow.com/a/74240138/2230249
function getMainReactProps (parent, target) {
  const keyOfReactProps = Object.keys(parent).find(k => k.startsWith('__reactProps$'))
  const symofReactFragment = Symbol.for('react.fragment')

  // Find the path from target to parent
  const path = []
  let elem = target
  while (elem !== parent) {
    let index = 0
    for (let sibling = elem; sibling != null;) {
      if (sibling[keyOfReactProps]) index++
      sibling = sibling.previousElementSibling
    }
    path.push({ child: elem, index })
    elem = elem.parentElement
  }
  // Walk down the path to find the react state props
  let state = elem[keyOfReactProps]
  for (let i = path.length - 1; i >= 0 && state != null; i--) {
    // Find the target child state index
    let childStateIndex = 0; let childElemIndex = 0
    while (childStateIndex < state.children.length) {
      const childState = state.children[childStateIndex]
      if (childState instanceof Object) {
        // Fragment children are inlined in the parent DOM element
        const isFragment = childState.type === symofReactFragment && childState.props.children.length
        childElemIndex += isFragment ? childState.props.children.length : 1
        if (childElemIndex === path[i].index) break
      }
      childStateIndex++
    }
    let childState = null
    if (state.children[childStateIndex]) {
      childState = state.children[childStateIndex]
    } else {
      if (childStateIndex === 0) {
        childState = state.children
      } else {
        for (let i = 0; i <= 3; i++) {
          if (state.children[i].props) {
            childState = state.children[i]
            break
          }
        }
      }
    }
    state = childState?.props
    elem = path[i].child
  }
  return state
}

const observer = new MutationObserver(callbackObserver)

function callbackObserver (mutationList) {
  for (const mutation of mutationList) {
    for (node of mutation.addedNodes) {
      findElementBadge(node)
    }
  }
}

observer.observe(document, {
  childList: true,
  subtree: true
})
