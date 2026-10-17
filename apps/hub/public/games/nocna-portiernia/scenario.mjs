// Source: GDD v1.0, 16.10.2026. Keep scenario data separate from presentation.
export const SCENARIO_VERSION = 'nocna-portiernia-1.0';
export const PROTOTYPE_LIMIT = 2; // Historical demo: only for checkpoint migration/tests.
export const GAME_LIMIT = 8;
export const residents = [
  { id:'jan', name:'Jan Wrona', flat:4, feature:'Łysina i szeroki siwy wąs' },
  { id:'teresa', name:'Teresa Mazur', flat:7, feature:'Kręcone włosy i okrągłe okulary' },
  { id:'pawel', name:'Paweł Lis', flat:11, feature:'Krótko ostrzyżony, przerwa w prawej brwi' },
  { id:'marta', name:'Marta Kurek', flat:16, feature:'Prosta grzywka, pieprzyk na lewym policzku' },
  { id:'roman', name:'Roman Bąk', flat:22, feature:'Szeroka twarz i gęsta broda' },
  { id:'irena', name:'Irena Wilk', flat:28, feature:'Podłużna twarz i siwy kok' },
];
export const visits = [
  { guest:'jan', card:'jan', name:'Jan Wrona', flat:4, allow:true, dialog:'Dobry wieczór. Wrona, czwórka. Z nocnej wracam.', explanation:'Jan Wrona mieszka pod 4. Nazwisko, mieszkanie i twarz są zgodne.' },
  { guest:'teresa', card:'teresa', name:'Teresa Mazur', flat:17, allow:false, dialog:'Teresa. Siódemka. Tylko proszę szybko, zimno strasznie.', explanation:'Teresa Mazur mieszka pod 7. Na karcie podano mieszkanie 17.' },
  { guest:'pawel', card:'pawel', name:'Paweł Lipiński', flat:11, allow:false, dialog:'Jedenastka. Klucze mam, ale drzwi znowu się zacinają.', explanation:'W spisie jest Paweł Lis, a na karcie Paweł Lipiński.' },
  { guest:'marta', card:'marta', name:'Marta Kurek', flat:16, allow:true, dialog:'Kurek. Szesnaście. Ktoś jest tam z panem?', explanation:'Marta Kurek mieszka pod 16. Wszystkie dane i twarz są zgodne.' },
  { guest:'roman', card:'jan', name:'Roman Bąk', flat:22, allow:false, dialog:'Bąk. Dwadzieścia dwa. Wszystko jest napisane.', explanation:'Dane Romana Bąka są zgodne, ale zdjęcie na karcie przedstawia Jana Wronę.' },
  { guest:'irena', card:'irena', name:'Irena Wilk', flat:28, allow:true, dialog:'Wilk, dwadzieścia osiem. Mogę już wejść?', explanation:'Irena Wilk mieszka pod 28. Wszystkie dane i twarz są zgodne.' },
  { guest:'pawel', card:'pawel', name:'Paweł Lis', flat:16, allow:false, dialog:'Poprawiłem. Teraz się zgadza.', explanation:'Paweł Lis mieszka pod 11. Na karcie podano mieszkanie 16.' },
  { guest:'roman', card:'jan', name:'Jan Wrona', flat:4, allow:false, dialog:'Dobry wieczór. Wrona, czwórka. Z nocnej wracam.', explanation:'Karta i spis przedstawiają Jana Wronę. Osoba przy okienku to Roman Bąk.' },
];
