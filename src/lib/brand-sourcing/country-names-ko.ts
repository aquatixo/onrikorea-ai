/**
 * English -> Korean country name translation. Every existing Brand row uses Korean
 * country names (e.g. "영국", "덴마크"), so anything the sourcing pipelines resolve in
 * English needs to be translated before it's stored, not left as "United Kingdom".
 * Keyed lowercase to match how countries.ts already normalizes for lookup.
 */
const COUNTRY_NAME_KO: Record<string, string> = {
  afghanistan: "아프가니스탄", albania: "알바니아", algeria: "알제리", andorra: "안도라",
  angola: "앙골라", argentina: "아르헨티나", armenia: "아르메니아", australia: "호주",
  austria: "오스트리아", azerbaijan: "아제르바이잔", bahamas: "바하마", bahrain: "바레인",
  bangladesh: "방글라데시", barbados: "바베이도스", belarus: "벨라루스", belgium: "벨기에",
  belize: "벨리즈", benin: "베냉", bhutan: "부탄", bolivia: "볼리비아",
  "bosnia and herzegovina": "보스니아 헤르체고비나", botswana: "보츠와나", brazil: "브라질",
  brunei: "브루나이", bulgaria: "불가리아", "burkina faso": "부르키나파소", burundi: "부룬디",
  cambodia: "캄보디아", cameroon: "카메룬", canada: "캐나다", chad: "차드", chile: "칠레",
  china: "중국", colombia: "콜롬비아", "costa rica": "코스타리카", croatia: "크로아티아",
  cuba: "쿠바", cyprus: "키프로스", czechia: "체코", "czech republic": "체코",
  denmark: "덴마크", djibouti: "지부티", "dominican republic": "도미니카공화국",
  ecuador: "에콰도르", egypt: "이집트", "el salvador": "엘살바도르", estonia: "에스토니아",
  ethiopia: "에티오피아", fiji: "피지", finland: "핀란드", france: "프랑스",
  gabon: "가봉", georgia: "조지아", germany: "독일", ghana: "가나", greece: "그리스",
  guatemala: "과테말라", guyana: "가이아나", haiti: "아이티", honduras: "온두라스",
  hungary: "헝가리", iceland: "아이슬란드", india: "인도", indonesia: "인도네시아",
  iran: "이란", iraq: "이라크", ireland: "아일랜드", israel: "이스라엘", italy: "이탈리아",
  jamaica: "자메이카", japan: "일본", jordan: "요르단", kazakhstan: "카자흐스탄",
  kenya: "케냐", kuwait: "쿠웨이트", kyrgyzstan: "키르기스스탄", laos: "라오스",
  latvia: "라트비아", lebanon: "레바논", liberia: "라이베리아", libya: "리비아",
  liechtenstein: "리히텐슈타인", lithuania: "리투아니아", luxembourg: "룩셈부르크",
  madagascar: "마다가스카르", malawi: "말라위", malaysia: "말레이시아", maldives: "몰디브",
  mali: "말리", malta: "몰타", mauritius: "모리셔스", mexico: "멕시코", moldova: "몰도바",
  monaco: "모나코", mongolia: "몽골", montenegro: "몬테네그로", morocco: "모로코",
  mozambique: "모잠비크", myanmar: "미얀마", namibia: "나미비아", nepal: "네팔",
  netherlands: "네덜란드", "new zealand": "뉴질랜드", nicaragua: "니카라과", niger: "니제르",
  nigeria: "나이지리아", "north korea": "북한", "north macedonia": "북마케도니아",
  norway: "노르웨이", oman: "오만", pakistan: "파키스탄", panama: "파나마",
  "papua new guinea": "파푸아뉴기니", paraguay: "파라과이", peru: "페루",
  philippines: "필리핀", poland: "폴란드", portugal: "포르투갈", qatar: "카타르",
  romania: "루마니아", russia: "러시아", rwanda: "르완다", "saudi arabia": "사우디아라비아",
  senegal: "세네갈", serbia: "세르비아", singapore: "싱가포르", slovakia: "슬로바키아",
  slovenia: "슬로베니아", "south africa": "남아프리카공화국", "south korea": "대한민국",
  spain: "스페인", "sri lanka": "스리랑카", sudan: "수단", sweden: "스웨덴",
  switzerland: "스위스", syria: "시리아", taiwan: "대만", tanzania: "탄자니아",
  thailand: "태국", tunisia: "튀니지", turkey: "튀르키예", uganda: "우간다",
  ukraine: "우크라이나", "united arab emirates": "아랍에미리트", "united kingdom": "영국",
  "united states": "미국", usa: "미국", uk: "영국", uruguay: "우루과이",
  uzbekistan: "우즈베키스탄", venezuela: "베네수엘라", vietnam: "베트남", yemen: "예멘",
  zambia: "잠비아", zimbabwe: "짐바브웨",
};

export function toKoreanCountryName(name: string): string {
  return COUNTRY_NAME_KO[name.trim().toLowerCase()] ?? name;
}
