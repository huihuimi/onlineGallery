import {IORule, MatchRule} from "@/ts/class/MatchRule";

/**
 *! appInfo 信息共享
 */
export const useAppInfoStore = defineStore("appInfo", () => {
  //s 容器信息
  const container = reactive({
    open: false, //s 开关标识符
    widthPercentage: 100, //s 宽度百分比
  });
  //s 窗口信息
  const window = reactive({
    width: useWindowSize().width,
    height: useWindowSize().height,
  });

  //s 进度(条)
  const loading = reactive({
    value: false,
    show: false,
    state: "",
    percentage: 0,
    //f 进度条初始化函数
    init: () => {
      loading.value = true;
      loading.show = true;
      loading.percentage = 0;
      loading.state = "";
    },
    //f 进度条重置函数
    reset: () => {
      setTimeout(async () => {
        // await nextTick();
        loading.value = false;
        loading.state = "success";
        setTimeout(async () => {
          // await nextTick();
          loading.show = false;
          loading.percentage = 0;
          loading.state = "";
        }, 1500);
      }, 500);
    },
  });

  return {container, window, loading};
});

/**
 *! 卡片 共享信息
 */
export const useCardsStore = defineStore("Cards", () => {
  const appInfo = useAppInfoStore();
  const toolBar = useToolBarStore();
  const ruleEditor = useRuleEditorStore();

  //s 数据
  const data = reactive({
    cardList: <matchCard[]>[], //s 卡片列表
    //f 所有匹配到的链接集合
    urlSet: <Set<string>>new Set(),
    //f 所有匹配到的dom集合
    domSet: <Set<any>>new Set(),
  });

  //j 有效的card列表
  const allValidCards = computed((): matchCard[] => {
    return data.cardList.filter((card) => card);
  });

  //j 过滤后的cardList结果(计算属性) 返回结果在script中需要使用.value访问
  const filterCards = computed((): matchCard[] => {
    const filter = toolBar.filter;
    const listControl = toolBar.listControl;
    let regex = filter.formats.value.length
      ? new RegExp(`(${filter.formats.value.join("|")})`)
      : new RegExp("");
    //s 过滤
    let cardList = allValidCards.value.filter(
      (card: matchCard) =>
        card.meta.width >= filter.size.width.value[0] &&
        card.meta.width <= filter.size.width.value[1] &&
        card.meta.height >= filter.size.height.value[0] &&
        card.meta.height <= filter.size.height.value[1] &&
        regex.test(card.linkUrl)
    );
    //s 排序
    if (listControl.sortMethod.value === "name-asc") {
      cardList = cardList.sort((a, b) => mixSort(a.name, b.name));
    } else if (listControl.sortMethod.value === "name-desc") {
      cardList = cardList.sort((a, b) => mixSort(b.name, a.name));
    } else if (listControl.sortMethod.value === "width-asc") {
      cardList = cardList.sort((a, b) => a.meta.width - b.meta.width);
    } else if (listControl.sortMethod.value === "width-desc") {
      cardList = cardList.sort((a, b) => b.meta.width - a.meta.width);
    } else if (listControl.sortMethod.value === "height-asc") {
      cardList = cardList.sort((a, b) => a.meta.height - b.meta.height);
    } else if (listControl.sortMethod.value === "height-desc") {
      cardList = cardList.sort((a, b) => b.meta.height - a.meta.height);
    }
    return cardList;
  });

  //j 可见card列表
  const visibleCards = computed((): matchCard[] => {
    return allValidCards.value.filter((card) => card.visible);
  });

  //j  选中的卡片列表
  const selectedCards = computed(() => {
    return filterCards.value.filter((card) => card.selected);
  });

  //f 获取卡片
  async function getCard(rule: IORule) {
    const filter = toolBar.filter;
    appInfo.loading.init();
    //s 每次处理完成一张时的回调
    const singleCallBack = async (
      card: matchCard,
      realIndex: number,
      processedCount: number,
      allCount: number
    ) => {
      // await nextTick();
      appInfo.loading.percentage = (processedCount / allCount) * 100;
      //s 防止重复
      if (card.match && !data.urlSet.has(card.linkUrl)) {
        // console.log("匹配成功!", card, filter);
        data.cardList[realIndex] = card;
        // data.cardList.push(card);
        data.urlSet.add(card.linkUrl); //s 记录匹配过的链接
        data.domSet.add(card.dom); //s 记录匹配过的dom

        //s 更新尺寸过滤器最大值
        const max =
          (filter.size.max =
          filter.size.max =
            Math.max(filter.size.max, filter.size.max, card.meta.width, card.meta.height));
        // console.log(max);
        filter.size.width.value = [filter.size.width.value[0], max];
        filter.size.height.value = [filter.size.height.value[0], max];
      }
    };
    //s 全部处理完成后的回调
    const finallyCallback = async (cardList_output: matchCard[], rowCardList: rowCard[]) => {
      // await nextTick();
      appInfo.loading.percentage = 100;
      appInfo.loading.reset();
      if (!cardList_output.length) {
        ElMessage({
          message: "没有匹配到合适的项目(请切换/创建预设后重试)",
          type: "info",
          showClose: true,
          grouping: true,
          offset: 120,
        });
      } else {
        // console.log(rowCardList);
        // console.log("匹配完成", data.domSet);
      }

      //s 所有操作都结束后对原先cardList中无效的项目进行过滤
      data.cardList = data.cardList.filter((card) => card);
    };
    // *定义每次处理完每个结果后的回调定义
    await getCardsByRule(rule, data.cardList.length, singleCallBack, finallyCallback, {
      maxLimit: 10,
      delay: 300,
      excludeDomSet: data.domSet,
      excludeUrlSet: data.urlSet,
    });
  }

  return {
    data,
    allValidCards,
    filterCards,
    visibleCards,
    selectedCards,
    getCard,
  };
});

/**
 *! ToolBar 共享信息
 */
export const useToolBarStore = defineStore("ToolBar", () => {
  const cardsStore = useCardsStore();
  const ruleEditor = useRuleEditorStore();

  const markStyle = reactive({
    "font-size": "10px !important",
    "margin-top": "0 !important",
    bottom: "10px",
  });

  type IFilter = {
    size: {
      width: {
        value: number[];
      };
      height: {
        value: number[];
      };
      max: number;
      marks: {
        [x: number]: any;
      };
    };
    formats: {
      options: any[];
      value: string[];
    };
  };

  //s 过滤器参数
  const filter: IFilter = reactive({
    size: {
      width: {
        value: [350, 500],
      },
      height: {
        value: [350, 500],
      },
      max: 500,
      marks: computed(() => {
        let tempMarks = {
          360: {
            label: "360",
            style: markStyle,
          },
          720: {
            label: "720",
            style: {
              ...markStyle,
              display: filter.size.max / 720 < 3 ? "" : "none",
            },
          },
          1080: {
            label: "1080",
            style: {
              ...markStyle,
              display: filter.size.max / 1080 < 3 ? "" : "none",
            },
          },
          1920: {
            label: "1920",
            style: {
              ...markStyle,
              display: filter.size.max / 1920 < 3 ? "" : "none",
            },
          },
          2560: {
            label: "2560",
            style: {
              ...markStyle,
              display: filter.size.max / 2560 < 3 ? "" : "none",
            },
          },
          3840: {
            label: "3840",
            style: markStyle,
          },
          [`${filter.size.max}`]: {
            label: `${filter.size.max}`,
            style: {
              ...markStyle,
              display: filter.size.max > 1.8 * 3840 ? "" : "none",
            },
          },
        };
        return tempMarks;
      }),
    },
    formats: {
      options: [
        {value: "png", label: "png"},
        {value: "jpg", label: "jpg"},
        {value: "jpeg", label: "jpeg"},
        {value: "gif", label: "gif"},
        {value: "bmp", label: "bmp"},
        {value: "webp", label: "webp"},
        {value: "svg", label: "svg"},
      ],
      value: [],
    },
  });

  //s 规则选择器
  const ruleSelector = reactive({
    value: <string | undefined>undefined,
    option: computed(() => {
      let options = [
        {
          value: "#",
          label: "(内置)默认规则",
          iconUrl: "",
        },
      ];
      options.push(
        ...ruleEditor.data.ruleList.map((rule) => {
          return {
            value: rule.id,
            label: rule.main.name,
            iconUrl: rule.main.iconUrl,
          };
        })
      );
      return options;
    }),
  });

  //s 列表控制信息
  const listControl = reactive({
    //s 排序方式
    sortMethod: {
      options: [
        {value: "#", label: "默认排序"},
        {value: "name-asc", label: "名称-升序"},
        {value: "name-desc", label: "名称-降序"},
        {value: "width-asc", label: "宽度-升序"},
        {value: "width-desc", label: "宽度-降序"},
        {value: "height-asc", label: "高度-升序"},
        {value: "height-desc", label: "高度-降序"},
      ],
      value: "#",
    },
    //s 显示行数
    showColumn: 3,
    allSelected: false,
  });

  //f 选出首个匹配的规则
  function selectingInitRule() {
    let targetRule: IORule | null = null;

    let matchedRule: IORule[] = ruleEditor.data.ruleList.filter((rule) => {
      //s 先过滤域名
      return new RegExp(`${rule.main.domainName}`).test(location.origin);
    });

    if (matchedRule.length) {
      //s 有限使用有路径过滤且匹配的
      for (let index = 0; index < matchedRule.length; index++) {
        const rule = matchedRule[index];
        if (!isEmpty(rule.main.pathFilter.pattern)) {
          const pattern = rule.main.pathFilter.pattern;
          const flags = rule.main.pathFilter.flags.join("");
          const regex = new RegExp(pattern, flags);

          const isMatch = regex.test(location.pathname + location.search);
          if (isMatch) {
            targetRule = rule;
            break;
          }
        }
      }
      targetRule = targetRule || matchedRule[0];
    }

    if (targetRule) {
      ruleSelector.value = targetRule.id;
      //? 初始化filter
      initFilter(targetRule);
    } else {
      //s 没有匹配到则使用默认规则
      ruleSelector.value = "#";
    }
  }

  //f 初始化filter
  function initFilter(rule: IORule) {
    filter.formats.value = rule.filter.formats;
    filter.size.width.value = rule.filter.width;
    filter.size.height.value = rule.filter.height;
    filter.size.max = Math.max(filter.size.max, rule.filter.width[1], rule.filter.height[1]);
  }

  return {filter, listControl, ruleSelector, selectingInitRule};
});

/**
 * ? node接口定义
 */
interface node {
  id: string;
  label: string;
  iconUrl?: string;
  children: node[];
  disabled: boolean;
  isNew?: boolean;
}
/**
 *! 规则管理器 共享信息
 */
export const useRuleEditorStore = defineStore("ruleEditor", () => {
  //s 容器
  const container = reactive({
    open: false,
  });

  //s 信息
  const info = reactive({
    showRuleId: "#",
    form: {
      activeName: <string>"main",
      realTimeData: <MatchRule | undefined>undefined,
    },
    tree: {
      query: "", //s 查询(过滤)文本
      //s 树形列表配置信息对象
      treeProps: {
        value: "id",
        label: "label",
        children: "children",
        disabled: "disabled",
      },
      //s 树形列表数据
      treeData: computed((): node[] => {
        let result = data.ruleList.map((rule) => {
          return <node>{
            id: rule.id,
            label: rule.main.name || "未命名规则",
            iconUrl: rule.main.iconUrl,
            children: [],
            disabled: false,
            isNew: rule.status.isNewCreated,
          };
        });
        result.push(<node>{
          id: "#",
          label: "创建规则",
          children: [],
          disabled: false,
        });
        return result;
      }),
    },
  });

  //s 数据
  const data = reactive({
    ruleList: <MatchRule[]>[], //s 规则列表
  });

  //f 获取用户本地规则信息
  const getLocationRule = async () => {
    let localRuleList = GM_getValue<string>("ruleList");
    if (localRuleList != null) {
      //s 本地数据不为空则直接赋值给组件
      data.ruleList = JSON.parse(localRuleList).map((rawRule: any) => {
        return new MatchRule(rawRule); //s 这里将本地数据解析出来的对象进一步转为Rule对象
      });
      console.log("数据已导入", data);
    } else {
      data.ruleList = [];
      console.log("本地数据为空 -> 初始化数据", data);
    }
  };

  //f 保存规则信息到本地
  async function saveRuleToLocation() {
    const list = data.ruleList.map((rule) => rule.getJsonData());
    const jsonData = `[${list.join(",")}]`;
    console.log("保存数据", jsonData);
    GM_setValue("ruleList", jsonData);
    ElMessage({
      type: "success",
      grouping: true,
      center: true,
      offset: 120,
      duration: 1000,
      message: `保存成功!`,
    });
  }

  //f 创建规则
  async function createRule(ruleObj?: Partial<IORule>): Promise<MatchRule | null> {
    let rule: MatchRule | null = null;
    //s 如果传入的对象不为空 -> 则尝试通过对象的方式创建 MatchRule
    if (ruleObj?.id && ruleObj?.main) {
      // console.log("传入的对象", ruleObj);
      try {
        rule = new MatchRule(ruleObj, {newCreate: true}); //s 通过Rule创建一个rule对象
      } catch (err) {
        // console.log("通过对象创建 MatchRule 失败!");
      }
    } else {
      rule = new MatchRule(
        {
          main: {
            name:"新规则",//s 规则名称
            domainName: location.origin, //s 记录域名
            pathFilter:{pattern:"",flags:[]},
            titleSelector:"",
            iconUrl: await getFavicon(), //s 获取图标链接
          },
        },
        {newCreate: true}
      ); //s 通过Rule创建一个rule对象
    }

    if (rule) {
      data.ruleList.push(rule); //s 并将其push进ruleList
      console.log("规则创建成功", rule);
    }
    return rule;
  }

  //f 删除规则
  async function deleteRule(id: string) {
    const index = data.ruleList.findIndex((item) => item.id === id);
    const target = data.ruleList.splice(index, 1);
    console.log("移除规则", target);
    MatchRule.count--;
  }

  //! 默认规则
  const defaultRule: IORule = reactive({
    id: "#",
    main: {
      name: "(内置)默认规则",
      domainName: "",
      pathFilter: {pattern: "", flags: []},
      titleSelector: "",
      iconUrl: "",
    },
    domItem: {enable: false, method: 0, selector: ["", "", "", ""]},
    linkUrl: {
      method: 0,
      selector: ['meta[property="og:image"]', "img[data-src]", "img[src]", "[srcset]"],
      infoType: 2,
      attribute: ["content", "srcset|data-src|src", "srcset|data-src|src", "srcset|data-src|src"],
    },
    picUrl: {
      enable: false,
      origin: 0,
      method: 0,
      selector: ["", "", "", ""],
      infoType: 3,
      attribute: ["", "", "", ""],
    },
    name: {
      enable: false,
      origin: 0,
      method: 0,
      selector: ["", "", "", ""],
      infoType: 4,
      attribute: ["", "", "", ""],
      fix:{},
    },
    meta: {
      enable: true,
      origin: 2,
      method: 0,
      selector: ["", "", "", ""],
      infoType: 0,
      attribute: ["", "", "", ""],
      getMethod: 0,
    },
    filter: {
      formats: [],
      width: [350, 500],
      height: [350, 500],
    },
  });

  return {
    container,
    info,
    data,
    defaultRule,
    getLocationRule,
    saveRuleToLocation,
    createRule,
    deleteRule,
  };
});

//s list仓库
export const useListInfoStore = defineStore("list", () => {
  //s 信息
  const info = reactive({
    nowColumn: <number>3,
    allSelected: false,
  });

  return {info};
});

//s eagle仓库
export const useEagleStore =  defineStore('eagle',()=>{
  //! 创建 eagle aip 对象
  const eagle = ref(new EagleAPI())

  //s 状态
  const saveBoxContainer = reactive({
    open:false
  })

  return{eagle,saveBoxContainer}
})
