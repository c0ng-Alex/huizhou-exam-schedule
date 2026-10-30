/* 惠州市考试工作日程系统 · 内置考试流程模板
   offset：负数=考前天数，0=考试当天，正数=考后天数 */
window.EXAM_TEMPLATES = {
  gaokao: {
    name: '普通高考',
    tasks: [
      { phase: '考前筹备', title: '发布考试报名通知', offset: -60, desc: '发布报名公告、报考指南、注意事项' },
      { phase: '考前筹备', title: '考生网上报名', offset: -55, desc: '开启网上报名系统，组织考生报名' },
      { phase: '考前筹备', title: '报名资格审核', offset: -50, desc: '各报名点初审、市级复审' },
      { phase: '考前筹备', title: '考生信息确认', offset: -45, desc: '考生现场确认、信息采集、照片上传' },
      { phase: '考前筹备', title: '考点考场设置申报', offset: -40, desc: '各考点申报考场数量、考场平面图' },
      { phase: '考前冲刺', title: '考点标准化检查', offset: -30, desc: '考点设备、监控、广播系统检查验收' },
      { phase: '考前冲刺', title: '考务人员培训安排', offset: -25, desc: '制定考务培训计划，确定培训时间地点' },
      { phase: '考前冲刺', title: '考生体检工作', offset: -25, desc: '组织考生体检，体检数据录入' },
      { phase: '考前冲刺', title: '考试经费预算下达', offset: -20, desc: '考试经费申请、拨付到位' },
      { phase: '考前冲刺', title: '试卷订购与统计', offset: -20, desc: '统计各科试卷需求量，上报省考试院' },
      { phase: '考前冲刺', title: '准考证打印准备', offset: -15, desc: '准考证排版、数据校验、打印安排' },
      { phase: '临考阶段', title: '考务工作会议召开', offset: -14, desc: '召开全市考务工作会议，部署考试工作' },
      { phase: '临考阶段', title: '考点主任考务培训', offset: -12, desc: '组织考点主任、考务组长培训' },
      { phase: '临考阶段', title: '考生准考证发放', offset: -10, desc: '准考证打印完成，发放至各学校/考生' },
      { phase: '临考阶段', title: '监考人员抽调与培训', offset: -7, desc: '确定监考人员名单，组织监考培训与考核' },
      { phase: '临考阶段', title: '考试物资准备', offset: -7, desc: '草稿纸、文具、封条、工作证等物资准备' },
      { phase: '临考阶段', title: '考点考场布置', offset: -3, desc: '考场清洁、桌椅摆放、座位号张贴、考场规则张贴' },
      { phase: '临考阶段', title: '考点设备联调测试', offset: -2, desc: '监控、广播、时钟、金属探测器等设备测试' },
      { phase: '临考阶段', title: '试卷押运到位', offset: -1, desc: '试卷从保密库押运至各考点保密室' },
      { phase: '临考阶段', title: '考点考前检查', offset: -1, desc: '市派巡视员到各考点检查考前准备情况' },
      { phase: '考试实施', title: '考试第一天', offset: 0, desc: '各科目考试，全程巡考', isExamDay: true },
      { phase: '考后工作', title: '试卷回收与送评', offset: 2, desc: '所有科目结束后，答题卡送省评卷点' },
      { phase: '考后工作', title: '考试工作总结', offset: 5, desc: '各考点上报工作总结，汇总全市考试情况' },
      { phase: '考后工作', title: '评卷工作开始', offset: 10, desc: '省统一组织网上评卷' },
      { phase: '考后工作', title: '成绩公布', offset: 15, desc: '考生成绩查询、成绩复核申请' },
      { phase: '考后工作', title: '志愿填报指导', offset: 18, desc: '组织志愿填报咨询、指导会' },
      { phase: '考后工作', title: '考生志愿填报', offset: 20, desc: '网上志愿填报系统开放' },
      { phase: '考后工作', title: '录取工作开始', offset: 30, desc: '高考录取工作启动' }
    ]
  },
  zhongkao: {
    name: '中考',
    tasks: [
      { phase: '考前筹备', title: '发布中考报名通知', offset: -90, desc: '发布报名工作通知、报考指南' },
      { phase: '考前筹备', title: '中考报名开始', offset: -85, desc: '组织全市初中毕业生报名' },
      { phase: '考前筹备', title: '报名资格审核', offset: -80, desc: '学籍核对、报名信息审核确认' },
      { phase: '考前筹备', title: '体育考试安排', offset: -60, desc: '体育中考考点安排、考务人员培训' },
      { phase: '考前筹备', title: '体育中考实施', offset: -50, desc: '组织全市体育中考考试' },
      { phase: '考前筹备', title: '考点考场申报', offset: -45, desc: '各考点申报考场、设备情况' },
      { phase: '考前筹备', title: '理化生实验操作考试', offset: -40, desc: '组织物理化学生物实验操作考试' },
      { phase: '考前冲刺', title: '考务工作会议', offset: -30, desc: '召开全市中考考务工作会议' },
      { phase: '考前冲刺', title: '考点标准化检查', offset: -25, desc: '考点监控、广播、设备检查验收' },
      { phase: '考前冲刺', title: '监考教师培训', offset: -15, desc: '监考人员抽调、培训、考核' },
      { phase: '考前冲刺', title: '准考证制作发放', offset: -10, desc: '准考证打印、发放至学校' },
      { phase: '考前冲刺', title: '考试物资准备', offset: -7, desc: '试卷、答题卡、文具等物资筹备' },
      { phase: '临考阶段', title: '考场布置', offset: -3, desc: '考场布置、座位号张贴、设备调试' },
      { phase: '临考阶段', title: '考点考前检查', offset: -2, desc: '市巡视员检查各考点准备情况' },
      { phase: '临考阶段', title: '试卷押运到位', offset: -1, desc: '试卷送达各考点保密室' },
      { phase: '考试实施', title: '中考第一天', offset: 0, desc: '各科目考试', isExamDay: true },
      { phase: '考后工作', title: '答题卡扫描', offset: 3, desc: '答题卡扫描、数据校验' },
      { phase: '考后工作', title: '网上评卷', offset: 5, desc: '组织各科教师网上评卷' },
      { phase: '考后工作', title: '成绩公布', offset: 12, desc: '考生成绩公布、查询' },
      { phase: '考后工作', title: '成绩复核', offset: 14, desc: '受理成绩复核申请' },
      { phase: '考后工作', title: '志愿填报', offset: 16, desc: '中考志愿填报' },
      { phase: '考后工作', title: '录取工作', offset: 25, desc: '高中阶段学校录取' }
    ]
  },
  xuekao: {
    name: '普通高中学业水平考试',
    tasks: [
      { phase: '考前筹备', title: '发布考试通知', offset: -60, desc: '发布学考报名考试通知' },
      { phase: '考前筹备', title: '网上报名', offset: -50, desc: '组织考生网上报名、缴费' },
      { phase: '考前筹备', title: '报名信息确认', offset: -45, desc: '考生信息确认、科目选择确认' },
      { phase: '考前筹备', title: '考点考场编排', offset: -30, desc: '考点安排、考场编排、座位号生成' },
      { phase: '考前冲刺', title: '考务工作部署', offset: -20, desc: '考务工作会议、任务分工' },
      { phase: '考前冲刺', title: '考点设备检查', offset: -14, desc: '标准化考点设备检查维护' },
      { phase: '考前冲刺', title: '监考人员培训', offset: -10, desc: '监考员抽调、考务培训' },
      { phase: '考前冲刺', title: '准考证打印发放', offset: -7, desc: '准考证打印、学校发放' },
      { phase: '临考阶段', title: '考场布置', offset: -2, desc: '考场布置、设备调试' },
      { phase: '临考阶段', title: '试卷送达考点', offset: -1, desc: '试卷押运至考点保密室' },
      { phase: '考试实施', title: '学业水平考试', offset: 0, desc: '学考各科目考试', isExamDay: true },
      { phase: '考后工作', title: '答题卡回送扫描', offset: 2, desc: '答题卡回收、扫描' },
      { phase: '考后工作', title: '评卷工作', offset: 5, desc: '组织网上评卷' },
      { phase: '考后工作', title: '成绩公布', offset: 15, desc: '考试成绩公布查询' }
    ]
  },
  zikao: {
    name: '高等教育自学考试',
    tasks: [
      { phase: '考前筹备', title: '发布报考简章', offset: -75, desc: '发布自考报考简章、课程安排' },
      { phase: '考前筹备', title: '新生注册报名', offset: -65, desc: '新生注册、现场确认、准考证制作' },
      { phase: '考前筹备', title: '在籍考生报考', offset: -60, desc: '在籍考生网上报考课程、缴费' },
      { phase: '考前筹备', title: '考点考场编排', offset: -40, desc: '考点安排、考场编排' },
      { phase: '考前冲刺', title: '考务工作会议', offset: -25, desc: '自考考务工作部署' },
      { phase: '考前冲刺', title: '监考人员抽调', offset: -20, desc: '监考员抽调与培训' },
      { phase: '考前冲刺', title: '试卷申报订购', offset: -15, desc: '试卷数量统计、申报' },
      { phase: '考前冲刺', title: '准考证发放', offset: -10, desc: '考试通知单/准考证打印发放' },
      { phase: '临考阶段', title: '考场布置', offset: -2, desc: '考场布置、设备检查' },
      { phase: '临考阶段', title: '试卷押运到位', offset: -1, desc: '试卷送达考点' },
      { phase: '考试实施', title: '自学考试', offset: 0, desc: '自学考试各科目', isExamDay: true },
      { phase: '考后工作', title: '试卷回送', offset: 2, desc: '答题卡/试卷回送省考试院' },
      { phase: '考后工作', title: '评卷工作', offset: 10, desc: '省统一组织评卷' },
      { phase: '考后工作', title: '成绩公布', offset: 25, desc: '考试成绩公布查询' },
      { phase: '考后工作', title: '成绩复核', offset: 30, desc: '受理成绩复核申请' }
    ]
  },
  chengkao: {
    name: '成人高考',
    tasks: [
      { phase: '考前筹备', title: '发布招生考试通知', offset: -90, desc: '发布成人高考招生工作通知' },
      { phase: '考前筹备', title: '网上报名', offset: -80, desc: '组织考生网上报名、填报志愿' },
      { phase: '考前筹备', title: '报名信息确认', offset: -70, desc: '现场确认、资格审核' },
      { phase: '考前筹备', title: '考点安排', offset: -50, desc: '考点设置、考场编排' },
      { phase: '考前冲刺', title: '考务工作会议', offset: -30, desc: '全市成考考务工作会议' },
      { phase: '考前冲刺', title: '监考人员培训', offset: -15, desc: '监考人员抽调与培训' },
      { phase: '考前冲刺', title: '准考证打印', offset: -10, desc: '考生网上打印准考证' },
      { phase: '临考阶段', title: '考场布置', offset: -2, desc: '考场布置、设备调试' },
      { phase: '临考阶段', title: '试卷到位', offset: -1, desc: '试卷押运至考点保密室' },
      { phase: '考试实施', title: '成人高考', offset: 0, desc: '成人高考各科目考试', isExamDay: true },
      { phase: '考后工作', title: '评卷工作', offset: 7, desc: '组织评卷' },
      { phase: '考后工作', title: '成绩公布', offset: 20, desc: '公布考试成绩' },
      { phase: '考后工作', title: '录取工作', offset: 35, desc: '成人高校招生录取' }
    ]
  },
  teacher_bishi: {
    name: '教师资格考试（笔试）',
    tasks: [
      { phase: '考前筹备', title: '发布笔试考试公告', offset: -60, desc: '发布中小学教师资格考试笔试公告' },
      { phase: '考前筹备', title: '网上报名', offset: -50, desc: '组织考生网上报名、选择考区科目' },
      { phase: '考前筹备', title: '报名资格审核', offset: -45, desc: '网上资格审核、缴费确认' },
      { phase: '考前筹备', title: '考点考场编排', offset: -30, desc: '考点设置、考场编排、座位号生成' },
      { phase: '考前冲刺', title: '考务工作会议', offset: -20, desc: '笔试考务工作部署会议' },
      { phase: '考前冲刺', title: '监考人员抽调培训', offset: -12, desc: '监考人员抽调、考务培训与考核' },
      { phase: '考前冲刺', title: '准考证打印', offset: -7, desc: '考生网上打印准考证' },
      { phase: '考前冲刺', title: '考试物资准备', offset: -5, desc: '试卷、答题卡、文具等物资筹备' },
      { phase: '临考阶段', title: '考点考场布置', offset: -2, desc: '考场布置、设备检查调试' },
      { phase: '临考阶段', title: '试卷押运到位', offset: -1, desc: '试卷押运至各考点保密室' },
      { phase: '临考阶段', title: '考前检查', offset: -1, desc: '市派巡视员到各考点检查考前准备' },
      { phase: '考试实施', title: '笔试考试日', offset: 0, desc: '综合素质、教育知识与能力等科目', isExamDay: true },
      { phase: '考后工作', title: '答题卡回送', offset: 2, desc: '答题卡回收、送省评卷点' },
      { phase: '考后工作', title: '笔试工作总结', offset: 5, desc: '各考点上报工作总结，汇总全市情况' },
      { phase: '考后工作', title: '笔试成绩公布', offset: 30, desc: '笔试成绩公布、考生查询' },
      { phase: '考后工作', title: '成绩复核', offset: 33, desc: '受理成绩复核申请' }
    ]
  },
  teacher_mianshi: {
    name: '教师资格考试（面试）',
    tasks: [
      { phase: '考前筹备', title: '发布面试公告', offset: -40, desc: '发布中小学教师资格考试面试公告' },
      { phase: '考前筹备', title: '面试网上报名', offset: -30, desc: '笔试合格考生网上报名面试' },
      { phase: '考前筹备', title: '面试资格审核', offset: -25, desc: '现场资格审核、缴费确认' },
      { phase: '考前筹备', title: '面试考点设置', offset: -20, desc: '确定面试考点、面试室数量' },
      { phase: '考前筹备', title: '考官遴选与培训', offset: -15, desc: '面试考官遴选、考官培训' },
      { phase: '考前冲刺', title: '面试考务工作会议', offset: -10, desc: '面试考务工作部署会议' },
      { phase: '考前冲刺', title: '工作人员培训', offset: -7, desc: '面试工作人员、引导员培训' },
      { phase: '考前冲刺', title: '面试准考证打印', offset: -7, desc: '考生网上打印面试准考证' },
      { phase: '考前冲刺', title: '面试物资准备', offset: -5, desc: '面试评分表、试题纸、文具等物资' },
      { phase: '临考阶段', title: '面试考场布置', offset: -2, desc: '面试室、候考室、备课室布置' },
      { phase: '临考阶段', title: '面试系统调试', offset: -1, desc: '面试测评系统、监控设备调试' },
      { phase: '考试实施', title: '面试考试日', offset: 0, desc: '结构化面试 + 试讲 + 答辩', isExamDay: true },
      { phase: '考后工作', title: '面试成绩录入', offset: 2, desc: '面试评分数据录入、校验' },
      { phase: '考后工作', title: '面试工作总结', offset: 3, desc: '各考点上报面试工作总结' },
      { phase: '考后工作', title: '面试成绩公布', offset: 30, desc: '面试成绩公布、合格证明查询' },
      { phase: '考后工作', title: '教师资格认定', offset: 45, desc: '教师资格认定申请受理' }
    ]
  },
  gongwuyuan: {
    name: '公务员录用考试',
    tasks: [
      { phase: '考前筹备', title: '发布招考公告', offset: -45, desc: '发布公务员招考公告、职位表' },
      { phase: '考前筹备', title: '网上报名', offset: -35, desc: '组织考生网上报名、选择职位' },
      { phase: '考前筹备', title: '资格初审', offset: -30, desc: '各招录单位网上资格初审' },
      { phase: '考前筹备', title: '报名缴费确认', offset: -25, desc: '缴费确认、报名人数统计' },
      { phase: '考前筹备', title: '考点考场编排', offset: -20, desc: '考点设置、考场编排' },
      { phase: '考前冲刺', title: '考务工作会议', offset: -14, desc: '考务工作部署会议' },
      { phase: '考前冲刺', title: '监考人员抽调培训', offset: -10, desc: '监考人员抽调与考务培训' },
      { phase: '考前冲刺', title: '准考证打印', offset: -7, desc: '考生网上打印准考证' },
      { phase: '临考阶段', title: '考场布置', offset: -2, desc: '考场布置、设备调试' },
      { phase: '临考阶段', title: '试卷到位', offset: -1, desc: '试卷押运至考点保密室' },
      { phase: '考试实施', title: '公共科目笔试', offset: 0, desc: '行测、申论等公共科目笔试', isExamDay: true },
      { phase: '考后工作', title: '答题卡扫描评卷', offset: 3, desc: '答题卡扫描、网上评卷' },
      { phase: '考后工作', title: '成绩公布', offset: 30, desc: '笔试成绩公布、排名查询' },
      { phase: '考后工作', title: '资格复审', offset: 40, desc: '面试前资格复审' }
    ]
  },
  custom: {
    name: '自定义考试',
    tasks: [
      { phase: '考前筹备', title: '发布考试通知', offset: -30, desc: '发布考试相关通知公告' },
      { phase: '考前筹备', title: '组织报名', offset: -25, desc: '组织考生报名' },
      { phase: '考前筹备', title: '资格审核', offset: -20, desc: '报名资格审核确认' },
      { phase: '考前冲刺', title: '考点安排', offset: -15, desc: '考点设置、考场编排' },
      { phase: '考前冲刺', title: '考务人员安排', offset: -10, desc: '监考人员抽调与培训' },
      { phase: '考前冲刺', title: '准考证发放', offset: -7, desc: '准考证制作发放' },
      { phase: '临考阶段', title: '考场布置', offset: -2, desc: '考场布置与设备检查' },
      { phase: '临考阶段', title: '试卷到位', offset: -1, desc: '试卷送达考点' },
      { phase: '考试实施', title: '考试当天', offset: 0, desc: '考试实施', isExamDay: true },
      { phase: '考后工作', title: '试卷回收', offset: 1, desc: '试卷/答题卡回收' },
      { phase: '考后工作', title: '评卷工作', offset: 3, desc: '组织评卷' },
      { phase: '考后工作', title: '成绩公布', offset: 10, desc: '公布考试成绩' }
    ]
  }
};

window.PHASE_ORDER = ['考前筹备', '考前冲刺', '临考阶段', '考试实施', '考后工作'];

window.PHASE_ICON = {
  '考前筹备': '📋',
  '考前冲刺': '⚡',
  '临考阶段': '⏰',
  '考试实施': '📝',
  '考后工作': '📊'
};
