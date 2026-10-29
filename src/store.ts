import{isOnboardingComplete}from'./onboarding-state.mjs';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export type Shortcut={id:string;name:string;url:string;color:string;mark:string;autoAppearance?:boolean;iconData?:string;iconVersion?:number;iconBacking?:string};
export const defaults:Shortcut[]=[
{id:'google',name:'Google',url:'https://google.com',color:'#fff',mark:'G'},
{id:'youtube',name:'YouTube',url:'https://youtube.com',color:'#ed2438',mark:'youtube'},
{id:'spotify',name:'Spotify',url:'https://open.spotify.com',color:'#0d2420',mark:'spotify'},
{id:'notion',name:'Notion',url:'https://notion.so',color:'#f6f3ee',mark:'N'},
{id:'figma',name:'Figma',url:'https://figma.com',color:'#25252a',mark:'figma'},
{id:'github',name:'GitHub',url:'https://github.com',color:'#202634',mark:'github'},
{id:'gmail',name:'Gmail',url:'https://mail.google.com',color:'#fff',mark:'gmail'},
{id:'netflix',name:'Netflix',url:'https://netflix.com',color:'#1d1016',mark:'netflix'},
{id:'pinterest',name:'Pinterest',url:'https://pinterest.com',color:'#c9243b',mark:'P'},
{id:'chatgpt',name:'ChatGPT',url:'https://chatgpt.com',color:'#287c6c',mark:'chatgpt'},
{id:'linear',name:'Linear',url:'https://linear.app',color:'#6259d9',mark:'linear'},
{id:'dribbble',name:'Dribbble',url:'https://dribbble.com',color:'#f4aac8',mark:'dribbble'}];
export type Prefs={onboardingComplete:boolean;name:string;wallpaper:string;hour24:boolean;seconds:boolean;clock:boolean;greeting:boolean;widgets:boolean;newTab:boolean;brightness:number;blur:number;engine:string;liveSuggestions:boolean;recentSearches:string[];notes:string;tasks:{id:string;text:string;done:boolean}[];shortcuts:Shortcut[]};
export const initial:Prefs={onboardingComplete:false,name:'Alex',wallpaper:'aurora',hour24:false,seconds:false,clock:true,greeting:true,widgets:true,newTab:false,brightness:100,blur:0,engine:'Google',liveSuggestions:true,recentSearches:[],notes:'A little space for your next big idea.',tasks:[{id:'1',text:'Make something wonderful',done:false}],shortcuts:defaults};
export const useStore=create<Prefs & {set:(v:Partial<Prefs>)=>void}>()(persist((set)=>({...initial,set:(v)=>set(v)}),{name:'nova-preferences',merge:(persisted,current)=>{const previous=persisted as Partial<Prefs>|undefined;return {...current,...previous,onboardingComplete:isOnboardingComplete(previous)}},onRehydrateStorage:()=>state=>{const chromeApi=(globalThis as any).chrome;if(chromeApi?.storage?.local){chromeApi.storage.local.get('nova-preferences',(v:any)=>{if(v['nova-preferences'])state?.set(v['nova-preferences']);});}}}));
useStore.subscribe(state=>{const api=(globalThis as any).chrome;if(api?.storage?.local){const {set,...data}=state;api.storage.local.set({'nova-preferences':data});}});
