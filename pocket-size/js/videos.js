// ============================================================================================
//  THE VIDEOS ON YOUR PHONE
//  --------------------------------------------------------------------------------------------
//  This is the list of shorts that show up while you doom-scroll at the start of the game.
//  Right now every short is a BLACK SCREEN on purpose (the real videos haven't been added yet).
//
//  To add a real video later:
//    1. Put the file in the  pocket-size/videos/  folder (for example  videos/clip1.mp4 )
//    2. Set  src: 'videos/clip1.mp4'  on one of the entries below.
//  You can add MORE than five entries - each playthrough picks five different ones at random,
//  so you never see the same short twice in a row.
//  Supported: .mp4 / .webm video, or an image (.jpg / .png / .gif).
// ============================================================================================

export const VIDEOS = [
  { src: '', user: '@tinyfacts', caption: 'you will NOT believe what an ant can lift 🐜 #science #fyp', sound: 'original sound - tinyfacts', likes: '482.1K', comments: '3,211' },
  { src: '', user: '@biscuit.the.golden', caption: 'he thinks the vacuum is his enemy 😭 #dogsoftiktok #golden', sound: 'Sneaky Snitch - Kevin MacLeod', likes: '1.2M', comments: '9,870' },
  { src: '', user: '@lifehacks_daily', caption: 'paper airplane that flies FOREVER ✈️ (step 3 is crazy) #diy', sound: 'original sound - lifehacks', likes: '233.9K', comments: '1,045' },
  { src: '', user: '@microworld', caption: 'this is what dust looks like under a microscope 🔬 #fyp #micro', sound: 'Ethereal Drift - ambient', likes: '97.4K', comments: '612' },
  { src: '', user: '@late.night.thoughts', caption: 'pov: it is 11:52pm and you said "one more video" 1 hour ago', sound: 'original sound - lnt', likes: '2.4M', comments: '41.3K' },
  { src: '', user: '@gamer.grind', caption: 'the graphics in this new game are UNREAL 🔥 #gaming', sound: 'Bass Boost Anthem', likes: '670K', comments: '5,532' },
  { src: '', user: '@bugguy', caption: 'rating backyard bugs by how scary they are at 1cm tall 🕷️', sound: 'original sound - bugguy', likes: '315K', comments: '2,904' },
];

// Seconds each short plays before you can scroll to the next one, and how many you watch.
export const SECONDS_PER_SHORT = 5;
export const SHORTS_BEFORE_BED = 5;
