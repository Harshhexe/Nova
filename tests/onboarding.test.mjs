import test from 'node:test';
import assert from 'node:assert/strict';
import{isOnboardingComplete}from'../src/onboarding-state.mjs';
test('first visitor starts onboarding',()=>{assert.equal(isOnboardingComplete(undefined),false);assert.equal(isOnboardingComplete(null),false)});
test('completed or skipped setup stays completed',()=>{assert.equal(isOnboardingComplete({name:'Harsh',onboardingComplete:true}),true)});
test('unfinished setup is not marked complete',()=>{assert.equal(isOnboardingComplete({onboardingComplete:false}),false)});
test('existing users skip newly introduced onboarding',()=>{assert.equal(isOnboardingComplete({name:'Harsh',wallpaper:'rose'}),true)});
