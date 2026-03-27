// ==============================
// 0. 기본 설정
// ==============================
const STORAGE_KEY = "music_gender_survey_state_v2";
let manualExitRequested = false;
let currentCompletedItems = 0;

// ==============================
// 1. 유틸 함수
// ==============================
function shuffle(array) {
  let copied = [...array];
  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function getRandomGenderScale() {
  const femaleLeft = Math.random() < 0.5;

  if (femaleLeft) {
    return {
      labels: ["매우 여성적", "다소 여성적", "중성적", "다소 남성적", "매우 남성적" , "그래도 잘 모르겠음(불확실함)"],
      order: "female_to_male"
    };
  } else {
    return {
      labels: ["매우 남성적", "다소 남성적", "중성적", "다소 여성적", "매우 여성적" , "그래도 잘 모르겠음(불확실함)"],
      order: "male_to_female"
    };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("저장 상태 파싱 실패:", e);
    return null;
  }
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

function ensureProgressBanner() {
  if (document.getElementById("progress-banner")) return;

  const banner = document.createElement("div");
  banner.id = "progress-banner";
  banner.innerHTML = `
    <div id="progress-text">진행 정보 준비 중...</div>
    <div id="progress-controls">
      <button id="save-exit-btn" class="progress-btn">중간 저장 후 나가기</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById("save-exit-btn").addEventListener("click", () => {
    manualExitRequested = true;
    jsPsych.endExperiment(
      "중간 저장이 완료되었습니다. 같은 브라우저와 같은 기기에서 다시 접속하면 이어서 진행할 수 있습니다."
    );
  });
}

function updateProgressBanner(completedItems, totalItems) {
  ensureProgressBanner();

  const remaining = totalItems - completedItems;
  const current = Math.min(completedItems + 1, totalItems);

  let text = "";
  if (completedItems >= totalItems) {
    text = `모든 곡을 완료했습니다. (총 ${totalItems}곡)`;
  } else {
    text = `현재 ${current}번째 곡 진행 중 · 완료 ${completedItems}곡 / 전체 ${totalItems}곡 · 남은 ${remaining}곡`;
  }

  const target = document.getElementById("progress-text");
  if (target) target.textContent = text;
}

function jsonArrayToCsv(rows) {
  if (!rows || rows.length === 0) return "";

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );

  const escapeCsv = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value).replace(/"/g, '""');
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  };

  const lines = [];
  lines.push(headers.map(escapeCsv).join(","));

  rows.forEach((row) => {
    const line = headers.map((h) => escapeCsv(row[h]));
    lines.push(line.join(","));
  });

  return lines.join("\n");
}

// ==============================
// 2. 저장 상태 로드
// ==============================
const savedState = loadState();

let demographicsCompleted = savedState?.demographicsCompleted || false;
let demographics = savedState?.demographics || null;
let randomizedTracks = savedState?.randomizedTracks || shuffle(tracks);
currentCompletedItems = savedState?.completedItems || 0;
let savedTrials = savedState?.savedTrials || [];

const totalItems = randomizedTracks.length;

// ==============================
// 3. jsPsych 초기화
// ==============================
const jsPsych = initJsPsych({
  on_data_update: function (data) {
    savedTrials.push(data);

    saveState({
      demographicsCompleted,
      demographics,
      randomizedTracks,
      completedItems: currentCompletedItems,
      savedTrials
    });
  },

  on_finish: function () {
    if (manualExitRequested) {
      document.body.innerHTML = `
        <div style="max-width:800px; margin:50px auto; font-family:sans-serif;">
          <h2>중간 저장이 완료되었습니다.</h2>
          <p>이 창을 닫아도 됩니다.</p>
          <p>같은 브라우저와 같은 기기에서 다시 접속하면 이어서 진행할 수 있습니다.</p>
        </div>
      `;
      return;
    }

    const csv = jsonArrayToCsv(savedTrials);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "music_gender_survey_data.csv";
    a.click();

    clearState();

    document.body.innerHTML = `
      <div style="max-width:800px; margin:50px auto; font-family:sans-serif;">
        <h2>설문이 완료되었습니다.</h2>
        <p>응답 데이터가 CSV 파일로 저장되었습니다. 감사합니다.</p>
      </div>
    `;
  }
});

// ==============================
// 4. 공통 참가자 정보 속성 추가
// ==============================
jsPsych.data.addProperties({
  participant_name: demographics?.name || "",
  participant_age: demographics?.age || "",
  participant_gender: demographics?.gender || "",
  participant_music_training: demographics?.music_training || ""
});

// ==============================
// 5. 타임라인 구성
// ==============================
let timeline = [];

// 첫 화면
if (savedState) {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <h2>AI 음악 젠더성 설문</h2>
      <p>이전에 저장된 진행 기록이 있습니다.</p>
      <p>완료된 곡 수: <strong>${currentCompletedItems}</strong> / ${totalItems}</p>
      <p>같은 브라우저와 같은 기기에서만 이어서 진행할 수 있습니다.</p>
    `,
    choices: ["이어하기", "처음부터 다시하기"],
    on_finish: function (data) {
      if (data.response === 1) {
        clearState();
        demographicsCompleted = false;
        demographics = null;
        randomizedTracks = shuffle(tracks);
        currentCompletedItems = 0;
        savedTrials = [];

        jsPsych.data.addProperties({
          participant_name: "",
          participant_age: "",
          participant_gender: "",
          participant_music_training: ""
        });
      }
    }
  });
} else {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <h2>AI 음악 젠더성 설문</h2>
      <p>각 음악을 들은 후 질문에 응답해 주세요.</p>
      <p>가능하면 이어폰 또는 헤드폰을 사용해 주세요.</p>
    `,
    choices: ["시작하기"]
  });
}

// 이름, 나이
if (!demographicsCompleted) {
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: "이름을 입력해 주세요.",
        name: "name",
        required: true
      },
      {
        prompt: "나이를 입력해 주세요.",
        name: "age",
        required: true
      }
    ],
    button_label: "다음",
    data: {
      question_type: "demographics_text"
    },
    on_finish: function (data) {
      const responses = data.response;

      demographics = {
        ...(demographics || {}),
        name: responses.name,
        age: responses.age
      };

      jsPsych.data.addProperties({
        participant_name: demographics.name || "",
        participant_age: demographics.age || "",
        participant_gender: demographics.gender || "",
        participant_music_training: demographics.music_training || ""
      });

      saveState({
        demographicsCompleted,
        demographics,
        randomizedTracks,
        completedItems: currentCompletedItems,
        savedTrials
      });
    }
  });

  // 성별, 음악 교육 경험
  timeline.push({
    type: jsPsychSurveyMultiChoice,
    questions: [
      {
        prompt: "성별(젠더)을 선택해 주세요.",
        name: "gender",
        options: ["여성", "남성", "논바이너리", "응답하고 싶지 않음", "기타"],
        required: true
      },
      {
        prompt: "음악 교육 경험을 선택해 주세요.",
        name: "music_training",
        options: [
          "없음",
          "1년 미만",
          "1년 이상 3년 미만",
          "3년 이상 5년 미만",
          "5년 이상",
          "현재도 배우고 있음"
        ],
        required: true
      }
    ],
    button_label: "다음",
    data: {
      question_type: "demographics_choice"
    },
    on_finish: function (data) {
      const responses = data.response;

      demographics = {
        ...(demographics || {}),
        gender: responses.gender,
        music_training: responses.music_training
      };

      demographicsCompleted = true;

      jsPsych.data.addProperties({
        participant_name: demographics.name || "",
        participant_age: demographics.age || "",
        participant_gender: demographics.gender || "",
        participant_music_training: demographics.music_training || ""
      });

      saveState({
        demographicsCompleted,
        demographics,
        randomizedTracks,
        completedItems: currentCompletedItems,
        savedTrials
      });
    }
  });
}

// 오디오 preload
timeline.push({
  type: jsPsychPreload,
  audio: randomizedTracks.slice(currentCompletedItems).map((t) => t.file)
});

// 남은 곡만 진행
const remainingTracks = randomizedTracks.slice(currentCompletedItems);

remainingTracks.forEach((track, localIndex) => {
  const globalIndex = currentCompletedItems + localIndex;
  const genderScale = getRandomGenderScale();

  // 진입 화면
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <p><strong>${globalIndex + 1}번째 음악</strong>입니다.</p>
      <p>버튼을 누르면 음악이 재생됩니다.</p>
    `,
    choices: ["재생하기"],
    data: {
      item_id: track.item_id,
      genre: track.genre,
      condition: track.condition,
      question_type: "item_intro"
    },
    on_load: function () {
      updateProgressBanner(globalIndex, totalItems);
    }
  });

  // 음악 재생
  timeline.push({
    type: jsPsychAudioButtonResponse,
    stimulus: track.file,
    choices: ["다 들었습니다"],
    response_allowed_while_playing: false,
    data: {
      item_id: track.item_id,
      genre: track.genre,
      condition: track.condition,
      question_type: "music_play"
    },
    on_load: function () {
      updateProgressBanner(globalIndex, totalItems);
    }
  });

  // Q1
  timeline.push({
    type: jsPsychSurveyLikert,
    questions: [
      {
        prompt: "이 곡이 특정 젠더 이미지를 떠올리게 했습니까?",
        labels: ["전혀 아니다", "아니다", "잘 모르겠다", "그렇다", "매우 그렇다"],
        required: true,
        name: "presence"
      }
    ],
    button_label: "다음",
    data: {
      item_id: track.item_id,
      genre: track.genre,
      condition: track.condition,
      question_type: "Q1_presence"
    },
    on_load: function () {
      updateProgressBanner(globalIndex, totalItems);
    }
  });

  // Q2
  timeline.push({
    type: jsPsychSurveyLikert,
    questions: [
      {
        prompt: "이 음악에 대한 젠더 이미지를 떠올려본다면 어느 쪽에 더 가까운가요?",
        labels: genderScale.labels,
        required: true,
        name: "direction"
      }
    ],
    button_label: "다음",
    data: {
      item_id: track.item_id,
      genre: track.genre,
      condition: track.condition,
      scale_order: genderScale.order,
      question_type: "Q2_direction"
    },
    on_load: function () {
      updateProgressBanner(globalIndex, totalItems);
    }
  });

  // Q3
  timeline.push({
    type: jsPsychSurveyLikert,
    questions: [
      {
        prompt: "이 판단에 얼마나 확신이 있습니까?",
        labels: ["1", "2", "3", "4", "5"],
        required: true,
        name: "confidence"
      }
    ],
    button_label: "다음",
    data: {
      item_id: track.item_id,
      genre: track.genre,
      condition: track.condition,
      question_type: "Q3_confidence"
    },
    on_load: function () {
      updateProgressBanner(globalIndex, totalItems);
    },
    on_finish: function () {
      currentCompletedItems = globalIndex + 1;

      saveState({
        demographicsCompleted,
        demographics,
        randomizedTracks,
        completedItems: currentCompletedItems,
        savedTrials
      });

      updateProgressBanner(currentCompletedItems, totalItems);
    }
  });
});

// 종료 화면
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <h3>모든 설문이 끝났습니다.</h3>
    <p>완료를 누르면 응답 데이터가 CSV 파일로 저장됩니다.</p>
  `,
  choices: ["완료"],
  on_load: function () {
    updateProgressBanner(totalItems, totalItems);
  }
});

// ==============================
// 6. 실행
// ==============================
ensureProgressBanner();
updateProgressBanner(currentCompletedItems, totalItems);

jsPsych.run(timeline);