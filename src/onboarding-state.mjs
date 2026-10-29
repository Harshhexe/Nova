export function isOnboardingComplete(saved){if(!saved||typeof saved!=='object')return false;return typeof saved.onboardingComplete==='boolean'?saved.onboardingComplete:true}
