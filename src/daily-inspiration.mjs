// Original NOVA prompts, bundled locally so daily inspiration also works offline.
export const inspirations=[
'Start small. Give one good idea a little room to grow.',
'You do not need to do everything today. Choose what matters.',
'A quiet moment can be the beginning of something wonderful.',
'Make space for the work that makes you feel like yourself.',
'Progress can be gentle and still take you somewhere new.',
'Let curiosity take the first step today.',
'One thoughtful thing is enough to begin.',
'Your attention is valuable. Spend a little of it on yourself.',
'There is room to pause between where you are and where you are going.',
'Leave a little space in your day for the unexpected.',
'An unfinished idea is an invitation to return.',
'Take the next useful step. The whole path can wait.',
'Let your day have a rhythm, not just a list.',
'You can care about your work without rushing through your life.',
'Notice something ordinary that deserves a second look.',
'A fresh start can happen in the middle of an ordinary day.',
'Build something you would be happy to find in the world.',
'Give your best idea a few uninterrupted minutes.',
'Some days, making things simpler is the most useful work.',
'You can change direction without starting from nothing.',
'Keep a little energy for the things that make you smile.',
'The smallest kind action still changes someone’s day.',
'Begin with what you have, and let the next step teach you.',
'A little less noise can make room for a clearer thought.',
'You are allowed to learn at your own pace.',
'Let a good question lead you somewhere interesting.',
'There is something worth noticing right where you are.',
'Leave your work a little better than you found it.',
'Choose presence for a moment. The next thing can wait.',
'Keep going gently. You are building more than you can see.',
'End one small thing before beginning another.'
];
export function inspirationForDate(date=new Date()){
 // Calendar-day arithmetic avoids daylight-saving days of 23 or 25 hours.
 const day=Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
 return {text:inspirations[((day%inspirations.length)+inspirations.length)%inspirations.length],author:'NOVA · DAILY INSPIRATION'};
}
export function millisecondsUntilMidnight(date=new Date()){
 return new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime()-date.getTime();
}
