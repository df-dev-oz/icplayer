package com.lorepo.icplayer.client.page;

import com.google.gwt.core.client.JavaScriptObject;
import com.google.gwt.event.shared.HandlerRegistration;
import com.google.gwt.user.client.Window;
import com.google.gwt.user.client.ui.Widget;
import com.lorepo.icf.scripting.ICommandReceiver;
import com.lorepo.icf.scripting.ScriptParserException;
import com.lorepo.icf.scripting.ScriptingEngine;
import com.lorepo.icf.utils.JavaScriptUtils;
import com.lorepo.icf.utils.NavigationModuleIndentifier;
import com.lorepo.icf.utils.TextToSpeechVoice;
import com.lorepo.icplayer.client.IPlayerController;
import com.lorepo.icplayer.client.content.services.GradualShowAnswersService;
import com.lorepo.icplayer.client.content.services.PlayerServices;
import com.lorepo.icplayer.client.metadata.IScoreWithMetadataPresenter;
import com.lorepo.icplayer.client.metadata.ScoreWithMetadata;
import com.lorepo.icplayer.client.model.Content;
import com.lorepo.icplayer.client.model.OutstretchPageHeight;
import com.lorepo.icplayer.client.model.layout.PageLayout;
import com.lorepo.icplayer.client.model.page.Page;
import com.lorepo.icplayer.client.model.page.group.Group;
import com.lorepo.icplayer.client.model.page.group.Group.ScoringGroupType;
import com.lorepo.icplayer.client.model.page.group.GroupPresenter;
import com.lorepo.icplayer.client.model.page.group.GroupView;
import com.lorepo.icplayer.client.model.page.properties.OutstretchHeightData;
import com.lorepo.icplayer.client.module.IModuleFactory;
import com.lorepo.icplayer.client.module.ModuleFactory;
import com.lorepo.icplayer.client.module.addon.AddonPresenter;
import com.lorepo.icplayer.client.module.api.*;
import com.lorepo.icplayer.client.module.api.event.*;
import com.lorepo.icplayer.client.module.api.player.*;
import com.lorepo.icplayer.client.page.Score.Result;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Set;


public class PageController implements ITextToSpeechController, IPageController {

	public interface IPageDisplay {
		void addModuleViewIntoGroup(IModuleView view, IModuleModel module, String groupId);
		void addGroupView(GroupView groupView);
		void addModuleView(IModuleView view, IModuleModel module);
		void setPage(Page page);
		void refreshMathJax();
		void setWidth(int width);
		void setHeight(int height);
		void removeAllModules();
		void outstretchHeight(int y, int difference, boolean isRestore, boolean dontMoveModules);
		void recalculatePageDimensions();
		HashMap<String, Widget> getWidgets();
	}
	
	private String PAGE_HEIGHT_MODIFICATIONS_KEY = "ICPLAYER_PAGE_HEIGHT_MODIFICATIONS";

	private IPageDisplay pageView;
	private Page currentPage;
	private PlayerServices playerServiceImpl;
	private IPlayerServices playerService;
	private IModuleFactory moduleFactory;
	private ArrayList<IPresenter> presenters;
	private ArrayList<GroupPresenter> groupPresenters; 
	private final ScriptingEngine scriptingEngine = new ScriptingEngine();
	private IPlayerController playerController;
	private HandlerRegistration valueChangedHandler;
	private final static String PAGE_TTS_MODULE_ID = "Text_To_Speech1";
	private boolean isReadingOn = false;
	private Content contentModel;
	private GradualShowAnswersService gradualShowAnswersService;
	private String previousLayoutName = "";
	
	public PageController(IPlayerController playerController) {
		this.playerController = playerController;
		playerServiceImpl = new PlayerServices(playerController, this);
		init(playerServiceImpl);
		gradualShowAnswersService = new GradualShowAnswersService(this);
	}

	public PageController(IPlayerServices playerServices) {
		init(playerServices);
	}

	private void init(IPlayerServices playerServices) {
		presenters = new ArrayList<IPresenter>();
		groupPresenters = new ArrayList<GroupPresenter>();
		this.playerService = playerServices;
		moduleFactory = new ModuleFactory(playerService);
	}

	public void setContent(Content model) {
		this.contentModel = model;
	}

	public void setView(IPageDisplay view) {
		pageView = view;
	}

	protected void setModuleFactory(IModuleFactory factory) {
		this.moduleFactory = factory;
	}

	public void sendPageAllOkOnValueChanged(boolean sendEvent) {
		if (sendEvent) {
			valueChangedHandler = playerService.getEventBus().addHandler(ValueChangedEvent.TYPE, new ValueChangedEvent.Handler() {
				@Override
				public void onScoreChanged(ValueChangedEvent event) {
					valueChanged(event);
				}
			});
		} else if (valueChangedHandler != null) {
			valueChangedHandler.removeHandler();
			valueChangedHandler = null;
		}
	}

	public void setPage(Page page) {
		if (playerServiceImpl != null) {
			playerServiceImpl.resetEventBus();
		}

		currentPage = page;
		this.setCurrentPageSemiResponsiveLayouts();

		pageView.setPage(page);
		this.setViewSize(page);
		pageView.recalculatePageDimensions();
		initModules();
		if (playerService.getStateService() != null) {
			HashMap<String, String> state = playerService.getStateService().getStates();
			setPageState(state);
		}

		pageView.refreshMathJax();
		this.restoreOutstretchHeights();
		playerService.getEventBus().fireEvent(new PageLoadedEvent(page.getName()));

		// header and footer?
		if (gradualShowAnswersService != null) {
			gradualShowAnswersService.refreshCurrentPagePresenters();
		}

		this.removePreviousPageOutstretch(page.getName());
		this.addPageOutstretch(page.getName());
	}

	private void removePreviousPageOutstretch(String pageName) {
		String layoutID = this.contentModel.getActualSemiResponsiveLayoutID();
		String actualLayoutName = this.contentModel.getLayoutNameByID(layoutID);

		if (this.previousLayoutName.isEmpty() || (this.previousLayoutName == actualLayoutName)) return;

		String formerLayoutKey = this.previousLayoutName
			.concat("_")
			.concat(pageName.replaceAll(" ", "_"));

		if (this.contentModel.hasOutstretchPage(formerLayoutKey)) {
			OutstretchPageHeight parameter = contentModel.getOutstretchPage(formerLayoutKey);
			this.outstretchHeight(
				parameter.getStartingStretchPoint(),
				-parameter.getValueOfStretching(),
				parameter.shouldMoveModels(),
				""
			);
		}
	}

	private void addPageOutstretch(String pageName) {
		String layoutID = this.contentModel.getActualSemiResponsiveLayoutID();
		String actualLayoutName = this.contentModel.getLayoutNameByID(layoutID);
		String layoutKey = actualLayoutName
			.concat("_")
			.concat(pageName.replaceAll(" ", "_"));
		
		if (this.previousLayoutName.equals(actualLayoutName)) return;
		
		if (!this.contentModel.isOutstretchPageDictionaryEmpty() && this.contentModel.hasOutstretchPage(layoutKey)) {
			OutstretchPageHeight parameter = contentModel.getOutstretchPage(layoutKey);
			this.outstretchHeight(
				parameter.getStartingStretchPoint(),
				parameter.getValueOfStretching(),
				parameter.shouldMoveModels(),
				""
			);
		}
	}

	public void sendResizeEvent() {
		ResizeWindowEvent event = new ResizeWindowEvent();
		playerService.getEventBus().fireEvent(event);
	}
	
	private void setViewSize(Page page) {
		if (page.getWidth() > 0) {
			pageView.setWidth(page.getWidth());
		}

		if (page.getHeight() > 0) {
			pageView.setHeight(page.getHeight());
		}
	}

	private void setCurrentPageSemiResponsiveLayouts() {
		String layoutID = this.contentModel.getActualSemiResponsiveLayoutID();
		Set<PageLayout> actualSemiResponsiveLayouts = this.contentModel.getActualSemiResponsiveLayouts();

		this.currentPage.syncPageSizes(actualSemiResponsiveLayouts);
		this.currentPage.syncSemiResponsiveStyles(actualSemiResponsiveLayouts);
		for (IModuleModel module : this.currentPage.getModules()) {
			module.syncSemiResponsiveStyles(actualSemiResponsiveLayouts);
			module.syncSemiResponsiveLayouts(actualSemiResponsiveLayouts);
			module.setSemiResponsiveLayoutID(layoutID);
		}
		
		for(Group group : this.currentPage.getGroupedModules()) {
		    group.syncSemiResponsiveStyles(actualSemiResponsiveLayouts);
			group.syncSemiResponsiveLayouts(actualSemiResponsiveLayouts);
			group.setSemiResponsiveLayoutID(layoutID);
		}

		this.currentPage.setSemiResponsiveLayoutID(layoutID);
	}

	private void restoreOutstretchHeights() {
		for (OutstretchHeightData data : this.currentPage.heightModifications.getOutStretchHeights()) {
			this.outstretchHeightWithoutAddingToModifications(data.y, data.height, true, data.dontMoveModules);
		}
	}

	protected void valueChanged(ValueChangedEvent event) {
		Score.Result result = getCurrentScore();
		if (result.errorCount == 0 && result.maxScore > 0 && result.score == result.maxScore) {
			playerService.getEventBus().fireEvent(new CustomEvent("PageAllOk", new HashMap<String, String>()));
		}
	}

	private void initModules() {
		groupPresenters.clear();
		presenters.clear();
		pageView.removeAllModules();
		
		scriptingEngine.reset();
		
		for(Group group : currentPage.getGroupedModules()) {
			GroupView groupView = moduleFactory.createView(group);
			GroupPresenter presenter = moduleFactory.createPresenter(group);
			pageView.addGroupView(groupView);
			presenter.addView(groupView);
			groupPresenters.add(presenter);
		}
		
		for (IModuleModel module : currentPage.getModules()) {
			String newInlineStyle = deletePositionImportantStyles(module.getInlineStyle());
			module.setInlineStyle(newInlineStyle);
			IModuleView moduleView = moduleFactory.createView(module);
			IPresenter presenter = moduleFactory.createPresenter(module);
			GroupPresenter groupPresenter = findGroupPresenter(module); 
			
			if(groupPresenter != null) {
				if(groupPresenter.getGroup().isDiv()) {
					pageView.addModuleViewIntoGroup(moduleView, module, groupPresenter.getGroup().getId());
				}else {
					pageView.addModuleView(moduleView, module);
				}
				groupPresenter.addPresenter(presenter);
			} else {
				pageView.addModuleView(moduleView, module);
			}

			addPresenter(presenter, moduleView);
		}
	}

	private void addPresenter(IPresenter presenter, IModuleView moduleView) {
		if (presenter != null) {
			presenter.addView(moduleView);
			presenters.add(presenter);
			if (presenter instanceof ICommandReceiver) {
				scriptingEngine.addReceiver((ICommandReceiver) presenter);
			}
		} else if (moduleView instanceof IPresenter) {
			presenters.add((IPresenter) moduleView);
		}
	}
	
	public String deletePositionImportantStyles (String inlineStyle) {
		String[] attributes = inlineStyle.split(";");
		StringBuilder strBuilder = new StringBuilder();
		for (String attribute: attributes) {
			if((attribute.contains("left") || attribute.contains("top")
					|| attribute.contains("right") || attribute.contains("bottom")) && (!attribute.contains("-left") && !attribute.contains("-top")
					&& !attribute.contains("-right") && !attribute.contains("-bottom")
					&& !attribute.contains("text-align") && !attribute.contains("vertical-align") && !attribute.contains("background") && !attribute.contains("gradient"))){
				continue;
			}
			strBuilder.append(attribute);
			strBuilder.append(";");
		}

		String newAttributes = strBuilder.toString();
		return newAttributes;
	}
	
	public GroupPresenter findGroupPresenter(IModuleModel module) {
		GroupPresenter groupPresenter = null; 
		for (GroupPresenter g :groupPresenters) {
			if (g.getGroup().contains(module)) {
				groupPresenter = g; 
			}
		}
		return groupPresenter; 
	}

	public Group findGroup(IModuleModel module) {
		List<Group> groups = currentPage.getGroupedModules();
		if (groups != null) {
			for (Group group : groups) {
				if (group.contains(module)) {
					return group;
				}
			}
		}

		return null;
	}
	
	public GroupPresenter findGroup(String id) {
		for (GroupPresenter presenter : groupPresenters) {
			if (presenter.getId().compareTo(id) == 0) {
				return presenter;
			}
		}
		return null;
	}

	protected ArrayList<IPresenter> createGroupPresenters(Group group) {
		ArrayList<IPresenter> groupPresenters = new ArrayList<IPresenter>();

		for (IModuleModel module : group) {
			for (int i = 0; i < presenters.size(); i++) {
				if (presenters.get(i).getModel().equals(module)) {
					groupPresenters.add(presenters.get(i));
				}
			}
		}

		return groupPresenters;
	}

	protected Result calculateScoreForEachGroup(Group group, ArrayList<IPresenter> groupPresenters, int groupMaxScore) {
		Result groupResult = new Result();

		for (IPresenter presenter : groupPresenters) {
			if (presenter instanceof IActivity) {
				IActivity activity = (IActivity) presenter;
				if (group.getScoringType() == ScoringGroupType.zeroMaxScore) {
					groupResult = Score.calculateZeroMaxScore(groupResult, activity);
				} else if (group.getScoringType() == ScoringGroupType.graduallyToMaxScore) {
					groupResult = Score.calculateGraduallyScore(groupResult, activity);
				} else if (group.getScoringType() == ScoringGroupType.minusErrors) {
					groupResult = Score.calculateMinusScoreForGroup(groupResult, activity);
				} else {
					groupResult = Score.calculateDefaultScore(groupResult, activity, currentPage.getScoringType());
				}
			}
		}

		return groupResult;
	}

	protected Result calculateScoreModulesOutGroup(Result groupsResult) {
		for (IPresenter presenter : presenters) {
			if (findGroup(presenter.getModel()) == null && presenter instanceof IActivity) {
				IActivity activity = (IActivity) presenter;
				groupsResult = Score.calculateDefaultScore(groupsResult, activity, currentPage.getScoringType());
			}
		}

		return groupsResult;
	}

	protected Result calculateScoreModulesInGroups() {
		Result groupsResult = new Result();
		if(currentPage.getGroupedModules() != null){
			for (Group group : currentPage.getGroupedModules()) {
				int groupMaxScore = group.getMaxScore();

				ArrayList<IPresenter> groupPresenters = createGroupPresenters(group);

				Result groupResult = calculateScoreForEachGroup(group, groupPresenters, groupMaxScore);

				if (group.getScoringType() == ScoringGroupType.defaultScore) {
					groupsResult = Score.updateDefaultGroupResult(groupsResult, groupResult);
				} else if (group.getScoringType() == ScoringGroupType.zeroMaxScore) {
					groupsResult = Score.updateZeroMaxGroupResult(groupsResult, groupResult, groupMaxScore);
				} else if (group.getScoringType() == ScoringGroupType.graduallyToMaxScore) {
					groupsResult = Score.updateGraduallyToMaxGroupResult(groupsResult, groupResult, groupMaxScore);
				} else if (group.getScoringType() == ScoringGroupType.minusErrors) {
					groupsResult = Score.updateMinusErrorsGroupResult(groupsResult, groupResult);
				}
			}
		}

		return groupsResult;
	}

	public void checkAnswers() {
		updateScore(true);
		playerService.getEventBus().fireEvent(new ShowErrorsEvent());
	}

	public void incrementCheckCounter() {
		updateScoreCheckCounter();
	}

	public void increaseMistakeCounter() {
		updateScoreMistakeCounter();

		ValueChangedEvent valueEvent = new ValueChangedEvent("", "", "increaseMistakeCounter", "");
		playerService.getEventBus().fireEvent(valueEvent);
	}

	public void updateScoreMistakeCounter() {
		if (currentPage != null && currentPage.isReportable()) {
			Score.Result result = getCurrentScore();
			PageScore pageScore = playerService.getScoreService().getPageScore(currentPage.getId());
			PageScore score = pageScore.updateScore(result.score, result.maxScore, result.errorCount);
			playerService.getScoreService().setPageScore(currentPage, score.increaseMistakeCounter());
		}
	}

	public void updateScoreWithMistakes(int mistakes) {
		if (currentPage != null && currentPage.isReportable()) {
			Score.Result result = getCurrentScore();
			PageScore pageScore = playerService.getScoreService().getPageScore(currentPage.getId());
			PageScore score = pageScore.updateScore(result.score, result.maxScore, result.errorCount);
			playerService.getScoreService().setPageScore(currentPage, score.incrementProvidedMistakes(mistakes));
		}
	}

	public void updateScore(boolean updateCounters) {
		if (currentPage != null && currentPage.isReportable()) {
			Score.Result result = getCurrentScore();
			PageScore pageScore = playerService.getScoreService().getPageScore(currentPage.getId());
			PageScore score = pageScore.updateScore(result.score, result.maxScore, result.errorCount);
			playerService.getScoreService().setPageScore(currentPage, updateCounters ? score.incrementCounters() : score);
		}
	}

	public void updateScoreCheckCounter() {
		if (currentPage != null && currentPage.isReportable()) {
			Score.Result result = getCurrentScore();
			PageScore pageScore = playerService.getScoreService().getPageScore(currentPage.getId());
			PageScore score = pageScore.updateScore(result.score, result.maxScore, result.errorCount);
			playerService.getScoreService().setPageScore(currentPage, score.incrementCheckCounter());
		}
	}

	private Result getCurrentScore() {
		Result groupsResult = calculateScoreModulesInGroups();

		if(groupsResult == null){
			Result result = new Result();
			result.score = 0;
			result.maxScore = 0;
			result.errorCount = 0;

			groupsResult = calculateScoreModulesOutGroup(result);
		} else {
			groupsResult = calculateScoreModulesOutGroup(groupsResult);
		}

		return groupsResult;
	}

	public void uncheckAnswers() {
		playerService.getEventBusService().getEventBus().fireEvent(new WorkModeEvent());
	}

	public void resetPageScore() {
		if(currentPage.isReportable()){
			PageScore pageScore = playerService.getScoreService().getPageScore(currentPage.getId());
			if(pageScore.hasScore()){
				PageScore score = pageScore.reset();
				playerService.getScoreService().setPageScore(currentPage, score);
			}
		}
	}

	public void sendResetEvent(boolean onlyWrongAnswers) {
		if (playerService.getPlayerStateService().isGradualShowAnswersMode()) {
			playerService.getGradualShowAnswersService().hideAll();
		}

		playerService.getEventBusService().getEventBus().fireEvent(new ResetPageEvent(onlyWrongAnswers));
	}

	public PageScore getPageScore() {
		if (currentPage == null || !currentPage.isReportable()) {
			return null;
		}

		return playerService.getScoreService().getPageScore(currentPage.getId());
	}
	
	private void setStatePresenters(List<? extends IPresenter> elements, HashMap<String, String> state) {
		for (IPresenter presenter : elements) {
			if (presenter instanceof IStateful) {
				IStateful statefulObj = (IStateful)presenter;
				String key = currentPage.getId() + statefulObj.getSerialId();
				String moduleState = state.get(key);
				if (moduleState != null) {
					statefulObj.setState(moduleState);
				}
			}
		}
	}
	
	public void setPageState(HashMap<String, String> state) {
		setStatePresenters(presenters, state); 
		setStatePresenters(groupPresenters, state);
		String heightModificationsState = state.get(this.getOutstretchUniqueHeightKey());
		if (heightModificationsState != null) {
			this.currentPage.heightModifications.setState(heightModificationsState);	
		}
	}
	
	private void getStatePresenters(List<? extends IPresenter> elements, HashMap<String, String>pageState) {
		for(IPresenter presenter : elements){
			if(presenter instanceof IStateful){
				IStateful statefulObj = (IStateful)presenter;
				String state = statefulObj.getState();
				String key = this.currentPage.getId() + statefulObj.getSerialId();
				pageState.put(key, state);
			}
			if (presenter instanceof IScoreWithMetadataPresenter) {
				IScoreWithMetadataPresenter swmPresenter = (IScoreWithMetadataPresenter) presenter;
				List<ScoreWithMetadata> scores = swmPresenter.getScoreWithMetadata();
				if (scores != null) {
					int pageIndex = playerController.getModel().getAllPages().indexOf(currentPage);
					for (ScoreWithMetadata score : scores) {
						score.setPage(this.currentPage, pageIndex);
					}
					playerController.getScoreWithMetadataService().addScoreWithMetadata(scores);
				}
			}
		}
	}
	
	public HashMap<String, String> getState() {
		HashMap<String, String>	pageState = new HashMap<String, String>();
		if(this.currentPage != null) {
			getStatePresenters(presenters, pageState); 
			getStatePresenters(groupPresenters, pageState); 
			pageState.put(this.getOutstretchUniqueHeightKey(), this.currentPage.heightModifications.getState());
		}
		
		
		return pageState;
	}
	
	private String getOutstretchUniqueHeightKey() {
		return this.currentPage.getId() + this.PAGE_HEIGHT_MODIFICATIONS_KEY;
	}

	public void runScript(String script) {
		try {
			scriptingEngine.execute(script);
		} catch (ScriptParserException e) {
			Window.alert(e.getMessage());
		}
	}

	public IPresenter findModule(String id) {
		for (IPresenter presenter : presenters) {
			if (presenter.getModel().getId().compareTo(id) == 0) {
				return presenter;
			}
		}

		return null;
	}
	
	public ITextToSpeechPresenter getPageTextToSpeechModule () {
		for (IPresenter presenter : presenters) {
			if (presenter.getModel().getId().compareTo(PAGE_TTS_MODULE_ID) == 0) {
				return new TextToSpeechPresenter(presenter);
			}
		}

		return null;
	}

	public IPage getPage () {
		return currentPage;
	}

	public void closePage() {
		if (playerServiceImpl != null) {
			playerServiceImpl.resetEventBus();
		}
		
		if (currentPage != null) {
			currentPage.release();
			currentPage = null;
		}

		pageView.removeAllModules();
		presenters.clear();
	}

	public IPlayerServices getPlayerServices() {
		return playerService;
	}

	@Override
	public void hideAnswers(String source) {
		HashMap<String, String> data = new HashMap<String, String>();
		data.put("source", source);
		CustomEvent event = new CustomEvent("HideAnswers", data);

		playerService.getEventBusService().getEventBus().fireEvent(event);
	}

	@Override
	public void showAnswers(String source) {
		HashMap<String, String> data = new HashMap<String, String>();
		data.put("source", source);
		CustomEvent event = new CustomEvent("ShowAnswers", data);

		playerService.getEventBusService().getEventBus().fireEvent(event);
	}

	public IPlayerController getPlayerController() {
		return playerController;
	}

	public List<IPresenter> getPresenters() {
		return presenters;
	}

	@Override
	public IGradualShowAnswersService getGradualShowAnswersService() {
		return gradualShowAnswersService;
	}

	public HashMap<String, Widget> getWidgets() {
		if (pageView != null) {
			return pageView.getWidgets();
		}

		return null;
	}

	public void outstretchHeight(int y, int height, boolean dontMoveModules, String layoutName) {
		String actualLayoutName = this.getActualLayoutName();
		this.updateOutstretchDictionary(y, height, dontMoveModules, layoutName);

		if (actualLayoutName.equals(layoutName) || layoutName.isEmpty()) {
			this.outstretchHeightWithoutAddingToModifications(y, height, false, dontMoveModules);
			this.currentPage.heightModifications.addOutstretchHeight(y, height, dontMoveModules);
			this.playerController.fireOutstretchHeightEvent();
			this.previousLayoutName = actualLayoutName;
		}
	}

	private boolean hasOppositeValue(int height, String layoutName) {
		String layoutKey = this.getLayoutKey(layoutName);
		
		if (!this.contentModel.isOutstretchPageDictionaryEmpty() && this.contentModel.hasOutstretchPage(layoutKey)) {
			OutstretchPageHeight parameter = contentModel.getOutstretchPage(layoutKey);
			return parameter.getValueOfStretching() == -height;
		}

		return false;
	}

	private String getActualLayoutName() {
		String layoutID = this.contentModel.getActualSemiResponsiveLayoutID();
		return this.contentModel.getLayoutNameByID(layoutID);
	}

	private String getLayoutKey(String layoutName) {
		String layoutKey = layoutName
			.concat("_")
			.concat(this.currentPage.getName().replaceAll(" ", "_"));
		
			return layoutKey;
	}

	private void updateOutstretchDictionary(int y, int height, boolean dontMoveModules, String layoutName) {
		if (layoutName.isEmpty()) return;
		
		String layoutKey = this.getLayoutKey(layoutName);
		if (this.hasOppositeValue(height, layoutName)) {
			this.contentModel.deleteOutstretchPage(layoutKey);
		} else {
			this.contentModel.addOutstretchPage(y, height, dontMoveModules, layoutKey);
		}
	}

	public void outstretchHeightWithoutAddingToModifications(int y, int height, boolean isRestore, boolean dontMoveModules) {
		this.pageView.outstretchHeight(y, height, isRestore, dontMoveModules);
	}

	public void playTitle (String area, String id, String langTag) {
		if (this.isReadingOn) {
			TextToSpeechAPI.playTitle(this.getTextToSpeechAPIJavaScriptObject(), area, id, langTag);
		}
	}

	public String getTitle (String area, String id) {
		if (this.isReadingOn) {
			return TextToSpeechAPI.getAddonTitle(this.getTextToSpeechAPIJavaScriptObject(), area, id);
		}
		return "";
	}

	public void speak (List<TextToSpeechVoice> voiceTexts) {
		if (this.isReadingOn) {
			TextToSpeechAPI.speak(this.getTextToSpeechAPIJavaScriptObject(), voiceTexts);
		}
	}
	
	public void readStartText () {
		TextToSpeechAPI.playEnterText(this.getTextToSpeechAPIJavaScriptObject());
	}
	
	public void readExitText () {
		TextToSpeechAPI.playExitText(this.getTextToSpeechAPIJavaScriptObject());
	}
	
	public void readPageTitle () {
		TextToSpeechAPI.playPageTitle(this.getTextToSpeechAPIJavaScriptObject());
	}

	public List<NavigationModuleIndentifier> getModulesOrder () {
		return JavaScriptUtils.convertJsArrayObjectsToJavaObjects(TextToSpeechAPI.getModulesOrder(this.getTextToSpeechAPIJavaScriptObject()));
	}
	
	public boolean isTextToSpeechModuleEnable () {
		return this.getTextToSpeechAPIJavaScriptObject() != null;
	}
	
	private JavaScriptObject getTextToSpeechAPIJavaScriptObject () {
		AddonPresenter textToSpeechAPIModule = (AddonPresenter) this.findModule("Text_To_Speech1");
		
		if (textToSpeechAPIModule != null) {
			return textToSpeechAPIModule.getAsJavaScript();
		}
		
		return null;
	}
	
	public void setTextReading (boolean isReadingOn) {
		this.isReadingOn = isReadingOn;
	}
	
	public void sendScrollEvent(int scrollValue) {
		String eventName = "ScrollEvent";
		HashMap<String, String> eventData = new HashMap<String, String>();
		eventData.put("value", Integer.toString(scrollValue));
		CustomEvent scrollEvent = new CustomEvent(eventName, eventData);

		this.playerService.getEventBus().fireEvent(scrollEvent);
	}
	
}
