/**
 * 카테고리별 상세페이지 프리셋
 * 각 카테고리에 최적화된 섹션 구조와 스토리라인을 정의
 */

export interface CategorySection {
  title: string;
  purpose: string;
  imageStyle: string;
}

export interface CategoryPreset {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  keywords: string[]; // AI 감지용 키워드
  sections: CategorySection[];
}

export const CATEGORY_PRESETS: Record<string, CategoryPreset> = {
  fashion: {
    id: 'fashion',
    name: '패션/의류',
    nameEn: 'Fashion/Apparel',
    emoji: '👗',
    keywords: ['clothing', 'apparel', 'fashion', 'dress', 'shirt', 'pants', 'jacket', 'coat', 'sweater', 'shoes', 'bag', 'accessory', '의류', '옷', '패션', '자켓', '코트', '원피스', '가방', '신발'],
    sections: [
      {
        title: '스타일 포인트',
        purpose: '트렌디한 디자인과 스타일링 포인트 강조',
        imageStyle: '모델 착용 전신컷, 트렌디한 배경, 패션 화보 스타일'
      },
      {
        title: '착용 핏 & 실루엣',
        purpose: '실제 착용 시 핏감과 실루엣, 체형별 추천',
        imageStyle: '다양한 각도의 착용샷, 핏감이 잘 보이는 포즈'
      },
      {
        title: '소재 & 디테일',
        purpose: '원단 품질, 봉제 디테일, 텍스처 강조',
        imageStyle: '소재 텍스처 클로즈업, 봉제선, 버튼/지퍼 디테일'
      },
      {
        title: '코디 제안',
        purpose: '다양한 스타일링 예시와 코디 팁',
        imageStyle: '여러 스타일의 코디 룩북, 상황별 착용 예시'
      },
      {
        title: '사이즈 가이드',
        purpose: '상세 사이즈표와 측정 방법 안내',
        imageStyle: '사이즈 차트 그래픽, 측정 포인트 표시'
      },
      {
        title: '케어 & 관리',
        purpose: '세탁 방법, 보관법, 관리 팁',
        imageStyle: '세탁 아이콘, 관리 방법 인포그래픽'
      }
    ]
  },
  
  beauty: {
    id: 'beauty',
    name: '뷰티/화장품',
    nameEn: 'Beauty/Cosmetics',
    emoji: '💄',
    keywords: ['cosmetics', 'skincare', 'makeup', 'serum', 'cream', 'lotion', 'foundation', 'lipstick', 'mascara', '화장품', '스킨케어', '메이크업', '세럼', '크림', '로션', '파운데이션', '립스틱'],
    sections: [
      {
        title: '핵심 효능',
        purpose: '제품의 주요 기능과 효과 강조',
        imageStyle: '제품 히어로샷 + 효과 시각화, 글로우 효과'
      },
      {
        title: '주요 성분',
        purpose: '핵심 성분과 원료의 효능 설명',
        imageStyle: '원료 이미지 + 성분 아이콘, 자연스러운 배경'
      },
      {
        title: '텍스처 & 사용감',
        purpose: '제형, 발림성, 흡수력 시각화',
        imageStyle: '텍스처 스와치, 피부 위 발림 컷, 클로즈업'
      },
      {
        title: '사용 방법',
        purpose: '올바른 사용법과 단계별 가이드',
        imageStyle: '스텝 바이 스텝 비주얼, 사용량 안내'
      },
      {
        title: '비포 & 애프터',
        purpose: '사용 전후 효과 비교',
        imageStyle: '전후 비교 이미지, 효과 시각화'
      },
      {
        title: '인증 & 안전',
        purpose: '피부 테스트 결과, 인증 마크',
        imageStyle: '인증마크 나열, 테스트 결과 그래픽'
      }
    ]
  },
  
  furniture: {
    id: 'furniture',
    name: '가구/인테리어',
    nameEn: 'Furniture/Interior',
    emoji: '🏠',
    keywords: ['furniture', 'interior', 'sofa', 'table', 'chair', 'desk', 'bed', 'shelf', 'cabinet', '가구', '인테리어', '소파', '테이블', '의자', '책상', '침대', '선반'],
    sections: [
      {
        title: '제품 소개',
        purpose: '디자인 컨셉과 주요 특징 소개',
        imageStyle: '인테리어 연출컷, 공간에 배치된 모습'
      },
      {
        title: '공간 활용',
        purpose: '다양한 공간에 배치된 예시',
        imageStyle: '거실, 침실, 사무실 등 다양한 공간 적용'
      },
      {
        title: '상세 스펙',
        purpose: '크기, 재질, 무게 등 상세 사양',
        imageStyle: '치수 도면, 스펙 그래픽, 측정 표시'
      },
      {
        title: '기능 설명',
        purpose: '조절, 수납, 변형 등 기능 상세',
        imageStyle: '기능 시연 컷, 사용 방법 비주얼'
      },
      {
        title: '조립 안내',
        purpose: '조립 방법, 설치 가이드',
        imageStyle: '조립 순서도, 부품 나열, 설명서 스타일'
      },
      {
        title: '품질 & A/S',
        purpose: '품질 보증, A/S 안내',
        imageStyle: '품질 인증 마크, 보증서 이미지'
      }
    ]
  },
  
  living: {
    id: 'living',
    name: '생활용품/주방',
    nameEn: 'Living/Kitchen',
    emoji: '🍳',
    keywords: ['kitchen', 'utensil', 'cookware', 'container', 'storage', 'cleaning', 'household', '주방', '용품', '그릇', '냄비', '프라이팬', '수납', '청소', '생활'],
    sections: [
      {
        title: '제품 소개',
        purpose: '핵심 장점과 차별화 포인트',
        imageStyle: '라이프스타일 연출컷, 사용 장면'
      },
      {
        title: '사용 편의성',
        purpose: '편리한 기능과 사용 방법',
        imageStyle: '사용 시연 컷, 손에 들고 있는 모습'
      },
      {
        title: '소재 & 내구성',
        purpose: '소재 품질, 안전성, 내구성',
        imageStyle: '소재 클로즈업, 내구성 테스트 비주얼'
      },
      {
        title: '활용 예시',
        purpose: '다양한 용도와 활용 방법',
        imageStyle: '여러 활용 장면, 다목적 사용 예시'
      },
      {
        title: '세척 & 관리',
        purpose: '세척 방법, 관리 팁',
        imageStyle: '세척 과정, 관리 방법 시연'
      },
      {
        title: '구성품',
        purpose: '패키지 구성 내용',
        imageStyle: '구성품 나열, 패키지 오픈 컷'
      }
    ]
  },
  
  food: {
    id: 'food',
    name: '식품/건강식품',
    nameEn: 'Food/Health',
    emoji: '🍎',
    keywords: ['food', 'snack', 'beverage', 'supplement', 'vitamin', 'health food', 'organic', '식품', '간식', '음료', '건강식품', '비타민', '영양제', '유기농'],
    sections: [
      {
        title: '제품 소개',
        purpose: '맛과 특징, 핵심 장점 강조',
        imageStyle: '푸드 스타일링, 맛있어 보이는 연출'
      },
      {
        title: '원재료 & 원산지',
        purpose: '원재료 품질, 원산지 정보',
        imageStyle: '원재료 이미지, 산지 비주얼'
      },
      {
        title: '영양 정보',
        purpose: '영양성분표, 칼로리 정보',
        imageStyle: '영양성분 그래픽, 성분표 시각화'
      },
      {
        title: '맛있게 먹는 법',
        purpose: '조리법, 섭취 방법, 레시피',
        imageStyle: '조리 과정, 플레이팅, 레시피 비주얼'
      },
      {
        title: '인증 & 안전',
        purpose: 'HACCP, 유기농 등 인증 정보',
        imageStyle: '인증마크 나열, 품질 인증 강조'
      },
      {
        title: '보관 방법',
        purpose: '유통기한, 보관법, 주의사항',
        imageStyle: '보관 방법 인포그래픽, 팁 시각화'
      }
    ]
  },
  
  electronics: {
    id: 'electronics',
    name: '전자제품/가전',
    nameEn: 'Electronics',
    emoji: '📱',
    keywords: ['electronics', 'gadget', 'device', 'appliance', 'phone', 'computer', 'audio', 'camera', '전자', '가전', '디바이스', '스마트폰', '컴퓨터', '오디오', '카메라'],
    sections: [
      {
        title: '제품 소개',
        purpose: '핵심 기능과 디자인 강조',
        imageStyle: '제품 히어로샷, 세련된 배경'
      },
      {
        title: '주요 기능',
        purpose: '핵심 기능 상세 설명',
        imageStyle: '기능별 비주얼, 사용 장면'
      },
      {
        title: '스펙 & 성능',
        purpose: '상세 사양, 성능 수치',
        imageStyle: '스펙 그래픽, 성능 비교 차트'
      },
      {
        title: '사용 방법',
        purpose: '조작법, UI 안내',
        imageStyle: 'UI 화면, 조작 방법 시연'
      },
      {
        title: '구성품',
        purpose: '패키지 포함 내용',
        imageStyle: '구성품 나열, 언박싱 컷'
      },
      {
        title: '보증 & A/S',
        purpose: '품질 보증, A/S 정책',
        imageStyle: '보증서, A/S 연락처, 인증마크'
      }
    ]
  },
  
  kids: {
    id: 'kids',
    name: '유아/아동용품',
    nameEn: 'Kids/Baby',
    emoji: '👶',
    keywords: ['baby', 'kids', 'children', 'toy', 'infant', 'toddler', 'child care', '유아', '아기', '아동', '키즈', '장난감', '육아', '어린이'],
    sections: [
      {
        title: '제품 소개',
        purpose: '핵심 장점, 아이에게 좋은 점',
        imageStyle: '아이가 사용하는 모습, 밝고 따뜻한 분위기'
      },
      {
        title: '안전 인증',
        purpose: 'KC 인증, 안전 테스트 결과',
        imageStyle: '인증마크 강조, 안전 테스트 비주얼'
      },
      {
        title: '소재 안전성',
        purpose: '무해 소재, 친환경 재질',
        imageStyle: '소재 설명, 무독성 표시'
      },
      {
        title: '사용 연령',
        purpose: '연령별 적합성, 발달 단계',
        imageStyle: '연령대 표시, 사용 가이드'
      },
      {
        title: '사용 방법',
        purpose: '올바른 사용법, 주의사항',
        imageStyle: '사용 시연, 부모 가이드'
      },
      {
        title: '세척 & 위생',
        purpose: '세척 방법, 위생 관리',
        imageStyle: '세척 과정, 관리 팁'
      }
    ]
  },
  
  pet: {
    id: 'pet',
    name: '반려동물용품',
    nameEn: 'Pet Supplies',
    emoji: '🐶',
    keywords: ['pet', 'dog', 'cat', 'animal', 'pet food', 'pet supplies', '반려', '강아지', '고양이', '펫', '사료', '간식', '용품'],
    sections: [
      {
        title: '제품 소개',
        purpose: '핵심 장점, 반려동물에게 좋은 점',
        imageStyle: '반려동물이 사용하는 모습'
      },
      {
        title: '성분 & 원료',
        purpose: '안전한 성분, 원료 품질',
        imageStyle: '원료 이미지, 성분 설명'
      },
      {
        title: '기호성',
        purpose: '맛, 선호도, 반응',
        imageStyle: '먹는 모습, 좋아하는 장면'
      },
      {
        title: '급여 방법',
        purpose: '권장 급여량, 급여 방법',
        imageStyle: '급여 가이드, 용량 표시'
      },
      {
        title: '안전 인증',
        purpose: '안전 테스트, 인증 정보',
        imageStyle: '인증마크, 테스트 결과'
      },
      {
        title: '보관 방법',
        purpose: '유통기한, 보관법',
        imageStyle: '보관 팁, 주의사항'
      }
    ]
  }
};

// 카테고리 ID 목록
export const CATEGORY_IDS = Object.keys(CATEGORY_PRESETS);

// 카테고리 선택 옵션 (UI용)
export const CATEGORY_OPTIONS = Object.values(CATEGORY_PRESETS).map(preset => ({
  id: preset.id,
  name: preset.name,
  nameWithEmoji: `${preset.emoji} ${preset.name}`,
  emoji: preset.emoji
}));

// 카테고리별 프롬프트 생성
export const getCategoryPromptGuidelines = (): string => {
  return Object.values(CATEGORY_PRESETS).map(preset => {
    const sectionList = preset.sections.map((s, i) => 
      `${i + 1}. ${s.title} - ${s.purpose}`
    ).join('\n      ');
    
    return `
    ### ${preset.emoji} ${preset.nameEn} (${preset.name}):
    Keywords: ${preset.keywords.slice(0, 5).join(', ')}
    Sections:
      ${sectionList}`;
  }).join('\n');
};

// 기본 카테고리 (감지 실패 시)
export const DEFAULT_CATEGORY = 'living';

