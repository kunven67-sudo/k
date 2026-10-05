// Townspeople looks (Rocketbox avatars converted for the game; see tools/avatars.txt).
// Jobs match the town's buildings; the game falls back to a default look if one is missing.
export const TOWN_LOOKS = [
  'Police_Female_01', 'Police_Male_01', 'Fire_Female_01', 'Fire_Male_01', 'Medical_Female_01', 'Medical_Male_01',
  'Chef_Female_01', 'Business_Female_01', 'Business_Female_03', 'Business_Male_01', 'Business_Male_04',
  'Construction_Male_01', 'Construction_Female_01', 'Delivery_Male_01', 'Gardener_Male_01', 'Security_Male_01',
  'Sports_Female_01', 'Sports_Male_02', 'Wood_Male_01', 'Female_Adult_02', 'Female_Adult_05', 'Female_Adult_08',
  'Female_Adult_12', 'Male_Adult_04', 'Male_Adult_07', 'Male_Adult_11', 'Male_Adult_15', 'Police_Male_03',
  'Fire_Male_04', 'Medical_Female_03',
];

export const isFemale = (look) => /Female/.test(look);
