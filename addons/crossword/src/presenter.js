function Addoncrossword_create(){
    var presenter = function() {};

    var playerController;
    var eventBus;
    var originalFieldValue = "";

    presenter.rowCount         = null;
    presenter.columnCount      = null;
    presenter.cellHeight       = null;
    presenter.cellWidth        = null;
    presenter.maxScore         = null;
    presenter.id               = null;
    presenter.isVisible        = true;
    presenter.showAllAnswersInGradualShowAnswersMode;
    presenter.isGradualShowAnswersActive = false;
    presenter.blankCellsBorderStyle  = "solid";
    presenter.blankCellsBorderWidth  = 0;
    presenter.blankCellsBorderColor  = "transparent";
    presenter.letterCellsBorderStyle = "solid";
    presenter.letterCellsBorderWidth = 0;
    presenter.letterCellsBorderColor = "transparent";
    presenter.wordNumbersHorizontal = false;
    presenter.wordNumbersVertical = false;
    presenter.disableAutomaticWordNumbering = false;
    presenter.markedColumnIndex = 0;
    presenter.markedRowIndex = 0;
    presenter.maxTabIndex = 0;

    var enableMoveToNextField = false;

    const DIRECTIONS = {
        NOT_SET: 0,
        HORIZONTAL: 1,
        VERTICAL: 2,
        TAB_INDEX: 3
    }
    var currentDirection = DIRECTIONS.NOT_SET;

    const AUTO_NAVIGATION_OPTIONS = {
        OFF: 0,
        SIMPLE: 1,
        EXTENDED: 2
    }
    var autoNavigationMode = null;

    presenter.SPECIAL_KEYS = {
        DELETE: 46,
        BACKSPACE: 8,
        TAB: 9,
        ESCAPE: 27,
        SHIFT: 16,
        CTRL: 17
    };

    presenter.numberOfConstantLetters = 0;

    presenter.ERROR_MESSAGES = {
        ROWS_NOT_SPECIFIED:                          "Amount of rows is not specified",
        COLUMNS_NOT_SPECIFIED:                       "Amount of columns is not specified",
        INVALID_MARKED_COLUMN_INDEX:                 "Marked column index cannot be negative, use 0 to disable",
        INVALID_MARKED_ROW_INDEX:                    "Marked row index cannot be negative, use 0 to disable",
        CELL_WIDTH_NOT_SPECIFIED:                    "Cell width is not specified",
        CELL_HEIGHT_NOT_SPECIFIED:                   "Cell height is not specified",
        INVALID_BLANK_CELLS_BORDER_WIDTH:            "Blank cells border width must be greater on equal to 0",
        INVALID_LETTER_CELLS_BORDER_WIDTH:           "Letter cells border width must be greater on equal to 0",
        INVALID_AMOUNT_OF_ROWS_IN_CROSSWORD:         "Amount of lines (that act as rows) in the specified Crossword is different that amount of rows you have specified in Properties",
        INVALID_AMOUNT_OF_COLUMNS_IN_CROSSWORD:      "Amount of characters (that act as columns) in row %row% of specified Crossword is different that amount of columns you have specified in Properties",
        DOUBLED_EXCLAMATION_MARK:                    "You cannot type 2 exclamation marks in a row",
        LAST_CHARACTER_EXCLAMATION_MARK:             "You cannot type exclamation mark at the end of line",
        EXCLAMATION_MARK_BEFORE_EMPTY_FIELD:         "You cannot type exclamation mark before empty field",
        NOT_SUPPORTED_SELECTED_AUTO_NAVIGATION_MODE: "Selected auto navigation mode is not supported"
    };

    presenter.VALIDATION_MODE = {
        COUNT_SCORE: 0,
        SHOW_ERRORS: 1
    };

    presenter.isModelValid = true;

    presenter.showErrorMessage = function(message, substitutions) {
        var errorContainer;
        if(typeof(substitutions) == 'undefined') {
            errorContainer = '<p>' + message + '</p>';
        } else {
            var messageSubst = message;
            for (var key in substitutions) {
                messageSubst = messageSubst.replace('%' + key + '%', substitutions[key]);
            }
            errorContainer = '<p>' + messageSubst + '</p>';
        }

        presenter.$view.html(errorContainer);
    };

    presenter.prepareGrid = function(model) {
        presenter.tabIndexBase = ($("div.crossword_container").length * 5000) + 5000;
        presenter.maxScore = 0;
        presenter.crossword = [];

        var rows = model['Crossword'].split("\n");
        for(var i = 0; i < presenter.rowCount; i++) {
            var r = [];
            var numberOfExclamationMarks = rows[i].match(/!/g) == null ? 0 : rows[i].match(/!/g).length;
            presenter.numberOfConstantLetters += numberOfExclamationMarks;
            for(var j = 0; j < presenter.columnCount + numberOfExclamationMarks; j++) {
                if (rows[i][j] === '!') {
                    j++;
                    r.push('!' + rows[i][j].toUpperCase());
                } else {
                    r.push(rows[i][j].toUpperCase());
                }
            }

            presenter.crossword.push(r);
        }
    };

    presenter.prepareCorrectAnswers = function() {
        presenter.correctAnswers = [];
        var answer, isHorizontal;
        for(var i = 0; i < presenter.rowCount; i++) {
            for(var j = 0; j < presenter.columnCount; j++){
                if(presenter.isHorizontalWordBegin(i, j)){
                    var position = {
                        x: j,
                        y: i
                    };
                    isHorizontal = true;
                    answer = "";
                    for(var k = j; k < presenter.columnCount; k++){
                        if(presenter.crossword[i][k] == ' '){
                            break;
                        }
                        answer = answer + presenter.crossword[i][k];
                    }
                    let answerData = {
                        answer: answer,
                        isHorizontal: isHorizontal,
                        position: position
                    };
                    presenter.correctAnswers.push(answerData);
                }
                if(presenter.isVerticalWordBegin(i, j)){
                    var position = {
                        x: j,
                        y: i
                    };
                    isHorizontal = false;
                    answer = "";
                    for(var k = i; k < presenter.rowCount; k++){
                        if(presenter.crossword[k][j] == ' '){
                            break;
                        }
                        answer = answer + presenter.crossword[k][j];
                    }
                    let answerData = {
                        answer: answer,
                        isHorizontal: isHorizontal,
                        position: position
                    };
                    presenter.correctAnswers.push(answerData);
                }
            }
        }
    }

    presenter.isHorizontalWordBegin = function(i, j) {
        if(!presenter.wordNumbersHorizontal)
            return false;

        return (
            // Skip empty cells
            presenter.crossword[i][j] != ' ' &&

                // We don't have a letter on the left
                (j === 0 ||  presenter.crossword[i][j-1] == ' ') &&

                // We do have a letter on the right
                (presenter.columnCount > j+1 && presenter.crossword[i][j+1] != ' '));
    };

    presenter.isVerticalWordBegin = function(i, j) {
        if(!presenter.wordNumbersVertical)
            return false;

        return (
            // Skip empty cells
            presenter.crossword[i][j] != ' ' &&

                // We don't have a letter above
                (i === 0 ||  presenter.crossword[i-1][j] == ' ') &&

                // We do have a letter below
                (presenter.rowCount > i+1 && presenter.crossword[i+1][j] != ' '));
    };

    function getPositionOfCellInputElement($cellInput) {
        return presenter.getPosition($cellInput.parent(''));
    }

    presenter.getPosition = function($elem) {
        function getPositionFrom(classes, dim) {
            return classes.reduce(function(res, currentElem) {
                return res === null ? currentElem.match(new RegExp(dim + "(\\d+)")) : res;
            }, null)[1];
        }

        var classes = $elem.attr('class').split(' ');

        return {
            x: parseInt(getPositionFrom(classes, 'cell_column_'), 10),
            y: parseInt(getPositionFrom(classes, 'cell_row_'), 10)
        }
    };

    var dictValues = function(dict) {
        var values = [];
        var keys = Object.keys(dict);
        keys.filter(function(key){
            values.push(dict[key])
        });
        return values;
    };

    presenter.SPECIAL_KEYS_CODES = dictValues(presenter.SPECIAL_KEYS);

    var validateSpecialKey = function(event) {
        // Allow: backspace, delete, tab, shift and escape
        if (presenter.SPECIAL_KEYS_CODES.indexOf(event.keyCode) > -1 ||
            // Allow:  dot
            (event.keyCode == 190) ||
            // Allow: Ctrl+A
            (event.keyCode == 65 && event.ctrlKey === true) ||
            // Allow: home, end, left, right
            (event.keyCode >= 35 && event.keyCode <= 39)) {
            // let it happen, don't do anything
            return true;
        }
        return false;
    };

    presenter.onCellInputKeyUp = function(event) {
        var currentCellInput = event.target;
        var $currentCellInput = $(currentCellInput);
        $currentCellInput.css('color','');

        if (validateSpecialKey(event)) {
            return
        }

        if ($currentCellInput.val().length > 1 && originalFieldValue.length > 0) {
            $currentCellInput.val($currentCellInput.val().replace(originalFieldValue,''));
        }
        originalFieldValue = '';

        currentCellInput.value = currentCellInput.value.toUpperCase();

        if ($currentCellInput.val() && enableMoveToNextField) {
            handleAutoNavigationMove(currentCellInput);
        }
    };

    function handleAutoNavigationMove(currentCellInput) {
        enableMoveToNextField = false;

        if (presenter.blockWrongAnswers) {
            var isCorrectValue
                = presenter.validateIsCorrectValueInCellInput(currentCellInput);
            if (!isCorrectValue) return;
        }

        if (!presenter.isAutoNavigationInOffMode()) {
            presenter.analyzeDirectionOfMove(currentCellInput);
            presenter.updateDirectionOfMoveRelativeToAutoNavigationMode();
            presenter.moveInCurrentDirection(currentCellInput);
        }
    }

    presenter.validateIsCorrectValueInCellInput = function (currentCellInput) {
        var $currentCellInput = $(currentCellInput);
        var usersLetter = currentCellInput.value[0];
        var currentPosition = getPositionOfCellInputElement($currentCellInput);

        var correctLetter = presenter.crossword[currentPosition.y][currentPosition.x][0];
        if (usersLetter !== correctLetter) {
            presenter.sendScoreEvent(currentPosition, usersLetter, false);
            currentCellInput.value = '';
            return false;
        }
        return true;
    };

    presenter.analyzeDirectionOfMove = function (currentCellInput) {
        var $currentCellInput = $(currentCellInput);
        var currentPosition = getPositionOfCellInputElement($currentCellInput);

        var rightElementPosition = calculateRightElementPosition(currentPosition);
        var isRightCellNotBlank = isPositionOfNotBlankCell(rightElementPosition);
        var rightCellsEditable = areRightCellsEditable(currentPosition);

        var bottomElementPosition = calculateBottomElementPosition(currentPosition);
        var isBottomCellNotBlank = isPositionOfNotBlankCell(bottomElementPosition);
        var bottomCellsEditable = areBottomCellsEditable(currentPosition);

        var topElementPosition = calculateTopElementPosition(currentPosition);
        var isTopCellNotBlank = isPositionOfNotBlankCell(topElementPosition);

        if (presenter.isHorizontalDirection()) {
            if (!rightCellsEditable) {
                presenter.setTabIndexDirection();
            }
            return;
        } else if (presenter.isVerticalDirection()) {
            if (!bottomCellsEditable) {
                presenter.setTabIndexDirection();
            }
            return;
        }

        var rightCellInput = getCellInput(rightElementPosition);
        var bottomCellInput = getCellInput(bottomElementPosition);

        if (bottomCellsEditable && !isRightCellNotBlank) {
            presenter.setVerticalDirection();
        } else if (rightCellsEditable && !isTopCellNotBlank && !isBottomCellNotBlank) {
            presenter.setHorizontalDirection();
        } else if (bottomCellsEditable && !isTopCellNotBlank && isRightCellNotBlank) {
            presenter.setVerticalDirection();
        } else if (bottomCellsEditable
            && (isRightCellNotBlank && !isCellInputElementEmpty(rightCellInput))
            && (isBottomCellNotBlank && isCellInputElementEmpty(bottomCellInput))) {
            presenter.setVerticalDirection();
        } else if (rightCellsEditable) {
            presenter.setHorizontalDirection();
        } else {
            presenter.setTabIndexDirection();
        }
    };

    function areRightCellsEditable(currentPosition) {
        return !!getNextRightEditableCellPosition(currentPosition);
    }

    function getNextRightEditableCellPosition(currentPosition) {
        const nextYPosition = currentPosition.y;
        var nextPosition;
        for (var nextXPosition = currentPosition.x + 1; nextXPosition < presenter.columnCount; nextXPosition++) {
            nextPosition = {y: nextYPosition, x: nextXPosition};
            var isNextCellNotBlank = isPositionOfNotBlankCell(nextPosition);
            if (isNextCellNotBlank) {
                var isNextCellConstant = isPositionOfConstantCell(nextPosition);
                if (!isNextCellConstant) {
                    return nextPosition;
                }
            } else {
                return;
            }
        }
    }

    function areBottomCellsEditable(currentPosition) {
        return !!getNextBottomEditableCellPosition(currentPosition);
    }

    function getNextBottomEditableCellPosition(currentPosition) {
        const nextXPosition = currentPosition.x;
        var nextPosition;
        for (var nextYPosition = currentPosition.y + 1; nextYPosition < presenter.rowCount; nextYPosition++) {
            nextPosition = {y: nextYPosition, x: nextXPosition};
            var isNextCellNotBlank = isPositionOfNotBlankCell(nextPosition);
            if (isNextCellNotBlank) {
                var isNextCellConstant = isPositionOfConstantCell(nextPosition);
                if (!isNextCellConstant) {
                    return nextPosition;
                }
            } else {
                return;
            }
        }
    }

    presenter.updateDirectionOfMoveRelativeToAutoNavigationMode = function () {
        if (!presenter.isDirectionNotSet()
            && (presenter.isAutoNavigationInOffMode()
                || (presenter.isAutoNavigationInSimpleMode()
                    && presenter.isTabIndexDirection()))) {
            presenter.resetDirection();
        }
    }

    presenter.moveInCurrentDirection = function (currentCellInput) {
        if (presenter.isHorizontalDirection()) {
            moveInHorizontalDirection(currentCellInput);
        } else if (presenter.isVerticalDirection()) {
            moveInVerticalDirection(currentCellInput);
        } else if (presenter.isTabIndexDirection()) {
            moveInTabIndexDirection(currentCellInput);
        }  else {
            blurCellInput(currentCellInput);
        }
    };

    function moveInVerticalDirection(currentCellInput) {
        var currentPosition = getPositionOfCellInputElement($(currentCellInput));
        var nextCellPosition = getNextBottomEditableCellPosition(currentPosition);
        if (!!nextCellPosition) {
            var nextCellInput = getCellInput(nextCellPosition);
            $(nextCellInput).focus();
        } else {
            blurCellInput(currentCellInput);
        }
    }

    function moveInHorizontalDirection(currentCellInput) {
        var currentPosition = getPositionOfCellInputElement($(currentCellInput));
        var nextCellPosition = getNextRightEditableCellPosition(currentPosition);
        if (!!nextCellPosition) {
            var nextCellInput = getCellInput(nextCellPosition);
            $(nextCellInput).focus();
        } else {
            blurCellInput(currentCellInput);
        }
    }

    function moveInTabIndexDirection(currentCellInput) {
        var nextTabIndex = currentCellInput.tabIndex + 1;
        if (nextTabIndex < presenter.maxTabIndex) {
            focusCellInputUsingTabIndex(nextTabIndex);
        } else {
            blurCellInput(currentCellInput);
        }
    }

    function focusCellInputUsingTabIndex(tabIndex) {
        presenter.$view.find('[tabindex=' + tabIndex + ']').focus();
    }

    function blurCellInput(cellInput) {
        $(cellInput).blur();
    }

    function calculateLeftElementPosition(oldPosition) {
        return {y: oldPosition.y, x: oldPosition.x - 1};
    }

    function calculateRightElementPosition(oldPosition) {
        return {y: oldPosition.y, x: oldPosition.x + 1};
    }

    function calculateTopElementPosition(oldPosition) {
        return {y: oldPosition.y - 1, x: oldPosition.x};
    }

    function calculateBottomElementPosition(oldPosition) {
        return {y: oldPosition.y + 1, x: oldPosition.x};
    }

    function isCellInputElementEmpty(element) {
        return !element.value;
    }

    function isPositionOfConstantCell(position) {
        if (!isPositionValid(position)) {
            return false;
        }
        return _isPositionOfConstantCell(position);
    }

    function _isPositionOfConstantCell(position) {
        return presenter.crossword[position.y][position.x][0].includes('!');
    }

    function isPositionOfNotBlankCell(position) {
        if (!isPositionValid(position)) {
            return false;
        }
        return _isPositionOfNotBlankCell(position);
    }

    function _isPositionOfNotBlankCell(position) {
        return presenter.crossword[position.y][position.x][0] !== ' ';
    }

    function getCellInput(position) {
        if (!isPositionValid(position)) {
            return;
        }
        return presenter.$view.find(`.cell_row_${position.y}.cell_column_${position.x}`).find("input")[0];
    }

    function isPositionValid(position) {
        return !!position
            && position.y >= 0 && position.y < presenter.rowCount
            && position.x >= 0 && position.x < presenter.columnCount;
    }

    presenter.isDirectionNotSet = function () {
        return currentDirection === DIRECTIONS.NOT_SET;
    }

    presenter.isHorizontalDirection = function () {
        return currentDirection === DIRECTIONS.HORIZONTAL;
    }

    presenter.isVerticalDirection = function () {
        return currentDirection === DIRECTIONS.VERTICAL;
    }

    presenter.isTabIndexDirection = function () {
        return currentDirection === DIRECTIONS.TAB_INDEX;
    }

    presenter.resetDirection = function () {
        currentDirection = DIRECTIONS.NOT_SET;
    }

    presenter.setHorizontalDirection = function () {
        currentDirection = DIRECTIONS.HORIZONTAL;
    }

    presenter.setVerticalDirection = function () {
        currentDirection = DIRECTIONS.VERTICAL;
    }

    presenter.setTabIndexDirection = function () {
        currentDirection = DIRECTIONS.TAB_INDEX;
    }

    presenter.onCellInputKeyDown = function(event) {
        var $target = $(event.target);
        if (event.keyCode == presenter.SPECIAL_KEYS.BACKSPACE) {
            if (!$target.val()) {
                var previous_tab_index = event.target.tabIndex - 1;
                if (previous_tab_index >= presenter.tabIndexBase) {
                    var previous_element = presenter.$view.find('[tabindex=' + previous_tab_index + ']');
                    previous_element.focus();
                    previous_element.val('');
                    return;
                }
            }
        }

        if (originalFieldValue.length == 0) {
            originalFieldValue = $target.val();
        }

        if (validateSpecialKey(event)) {
            return
        }

        $target.css('color', 'rgba(0,0,0,0.0)');
        enableMoveToNextField = true;
    };

    presenter.onCellInputFocus = function(event) {
        event.target.select();
        var length = $(event.target).val().length;
        setCaretPosition(event.target, length + 1);
        if(length > 1) {
            $(event.target).val($(event.target).val().substring(1, 2));
        }
        $(event.target).val($(event.target).val().toUpperCase());
    };
 
    presenter.onCellInputMouseUp = function(event) {
        event.preventDefault();
    };

    presenter.onCellInputFocusOut = function(event) {
        var cellInput = event.target;
        var usersLetter = cellInput.value;
        var pos = getPositionOfCellInputElement($(cellInput));
        var correctLetter = presenter.crossword[pos.y][pos.x][0];
        var isOk = usersLetter === correctLetter;
        presenter.sendScoreEvent(pos, usersLetter, isOk);
        var score = isOk ? 1 : 0;
        if(score == 0 && presenter.blockWrongAnswers){
            cellInput.value = "";
        }
        if (isOk) {
            var result = presenter.validateWord(pos);
            if (result.valid) {
                presenter.sendCorrectWordEvent(result.word, result.item);
            }
        }
    };

    presenter.onCellClick = function(event) {
        presenter.resetDirection();
        event.stopPropagation();
    };

    function setCaretPosition(elem, caretPos) {
        var range;

        if (elem.createTextRange) {
            range = elem.createTextRange();
            range.move('character', caretPos);
            range.select();
        } else {
            elem.focus();
            if (elem.selectionStart !== undefined) {
                elem.setSelectionRange(caretPos, caretPos);
            }
        }
    }

    presenter.createGrid = function() {
        var wordNumberCounter = 1;

        var gridContainer = $('<div class="crossword_container"></div>');
        gridContainer
            .css({ width:      presenter.columnCount * presenter.cellWidth + 'px',
                height:     presenter.rowCount * presenter.cellHeight + 'px',
                marginLeft: -1 * Math.round(presenter.columnCount * presenter.cellWidth / 2) + 'px',
                marginTop:  -1 * Math.round(presenter.rowCount * presenter.cellHeight / 2) + 'px' });

        var tabIndexOffset = 0;
        for(var i = 0; i < presenter.rowCount; i++) {
            for(var j = 0; j < presenter.columnCount; j++) {
                var cellContainer = $('<div class="cell_container"></div>');
                cellContainer.css({ width:  presenter.cellWidth + 'px',
                    height: presenter.cellHeight + 'px' });

                var cell = $('<div class="cell"></div>')
                    .addClass('cell_' + i + 'x' + j)
                    .addClass('cell_row_' + i)
                    .addClass('cell_column_' + j);

                if(presenter.markedRowIndex > 0 && presenter.markedRowIndex == i+1) {
                    cell.addClass('cell_row_marked');
                }

                if(presenter.markedColumnIndex > 0 && presenter.markedColumnIndex == j+1) {
                    cell.addClass('cell_column_marked');
                }

                cellContainer.append(cell);

                if(presenter.crossword[i][j] == ' ') {
                    cell.addClass('cell_blank');
                    cellContainer.addClass('cell_container_blank');
                } else {
                    cell.addClass('cell_letter');
                    cellContainer.addClass('cell_container_letter');

                    var input = $('<input type="text" maxlength="2" size="1"/>');

                    if (presenter.crossword[i][j][0] === '!') {
                        input
                            .val(presenter.crossword[i][j][1])
                            .prop('disabled', true);

                        cell.addClass("cell_constant_letter");
                        cell.addClass("");
                    } else {
                        input
                            .attr('tabIndex', presenter.tabIndexBase + tabIndexOffset++)
                            .keyup(presenter.onCellInputKeyUp)
                            .keydown(presenter.onCellInputKeyDown)
                            .focus(presenter.onCellInputFocus)
                            .mouseup(presenter.onCellInputMouseUp)
                            .focusout(presenter.onCellInputFocusOut)
                            .click(presenter.onCellClick);
                    }

                    if(presenter.preview) {
                        input.attr({
                            value: presenter.crossword[i][j].toUpperCase(),
                            disabled: true
                        });
                    }

                    cell.append(input);

                    var horizontalWordBegin = presenter.isHorizontalWordBegin(i, j);
                    var verticalWordBegin = presenter.isVerticalWordBegin(i, j);

                    if (horizontalWordBegin) presenter.maxScore++;
                    if (verticalWordBegin) presenter.maxScore++;

                    if(horizontalWordBegin || verticalWordBegin) {
                        cell.addClass('cell_word_begin');

                        if(horizontalWordBegin)
                            cell.addClass('cell_word_begin_horizontal');

                        if(verticalWordBegin)
                            cell.addClass('cell_word_begin_vertical');

                        if(!presenter.disableAutomaticWordNumbering) {
                            var wordNumber = $('<div class="word_number"></div>').html(wordNumberCounter++);

                            cell.append(wordNumber);
                        }
                    }
                }

                presenter.maxTabIndex = presenter.tabIndexBase + tabIndexOffset;

                // Cell borders
                var borderStyle;
                var borderWidth;
                var borderColor;

                if(presenter.crossword[i][j] != ' ') {
                    borderStyle = presenter.letterCellsBorderStyle;
                    borderWidth = presenter.letterCellsBorderWidth;
                    borderColor = presenter.letterCellsBorderColor;

                } else {
                    borderStyle = presenter.blankCellsBorderStyle;
                    borderWidth = presenter.blankCellsBorderWidth;
                    borderColor = presenter.blankCellsBorderColor;
                }

                if(i === 0 || presenter.crossword[i-1][j] == ' ') { // Outer top border
                    cell.css({ borderTopStyle: borderStyle,
                        borderTopWidth: (borderWidth * 2) + 'px',
                        borderTopColor: borderColor,
                        top:            (borderWidth * -1) + 'px' });
                } else { // Inner top border
                    cell.css({ borderTopStyle: borderStyle,
                        borderTopWidth: borderWidth + 'px',
                        borderTopColor: borderColor });
                }

                if(i === presenter.rowCount - 1 || presenter.crossword[i+1][j] == ' ') { // Outer bottom border
                    cell.css({ borderBottomStyle: borderStyle,
                        borderBottomWidth: (borderWidth * 2) + 'px',
                        borderBottomColor: borderColor,
                        bottom:            (borderWidth * -1) + 'px' });
                } else { // Inner bottom border
                    cell.css({ borderBottomStyle: borderStyle,
                        borderBottomWidth: borderWidth + 'px',
                        borderBottomColor: borderColor });
                }

                if(j === 0 || presenter.crossword[i][j-1] == ' ') { // Outer left border
                    cell.css({ borderLeftStyle: borderStyle,
                        borderLeftWidth: (borderWidth * 2) + 'px',
                        borderLeftColor: borderColor,
                        left:            (borderWidth * -1) + 'px' });
                } else { // Inner left border
                    cell.css({ borderLeftStyle: borderStyle,
                        borderLeftWidth: borderWidth + 'px',
                        borderLeftColor: borderColor });
                }

                if(j === presenter.columnCount - 1 || presenter.crossword[i][j+1] == ' ') { // Outer right border
                    cell.css({ borderRightStyle: borderStyle,
                        borderRightWidth: (borderWidth * 2) + 'px',
                        borderRightColor: borderColor,
                        right:            (borderWidth * -1) + 'px' });
                } else { // Inner right border
                    cell.css({ borderRightStyle: borderStyle,
                        borderRightWidth: borderWidth + 'px',
                        borderRightColor: borderColor });
                }

                // Additional classes
                if(j == 0) {
                    cell.addClass('cell_first_in_row');
                } else if(j == presenter.columnCount - 1) {
                    cell.addClass('cell_last_in_row');
                }

                if(i == 0) {
                    cell.addClass('cell_first_in_column');
                } else if(i == presenter.rowCount - 1) {
                    cell.addClass('cell_last_in_column');
                }

                gridContainer.append(cellContainer);
            }
        }

        presenter.$view.append(gridContainer);
    };

    function returnErrorMessage(errorMessage, errorMessageSubstitutions) {
        return {
            isError: true,
            errorMessage: errorMessage,
            errorMessageSubstitutions: errorMessageSubstitutions
        }
    }

    presenter.readConfiguration = function(model) {
        if(typeof(model['Blank cells border color']) != "undefined" && model['Blank cells border color'] !== "")
            presenter.blankCellsBorderColor = model['Blank cells border color'];

        if(typeof(model['Blank cells border width']) != "undefined" && model['Blank cells border width'] !== "")
            presenter.blankCellsBorderWidth = parseInt(model['Blank cells border width']);

        if(typeof(model['Blank cells border style']) != "undefined" && model['Blank cells border style'] !== "")
            presenter.blankCellsBorderStyle = model['Blank cells border style'];

        if(typeof(model['Letter cells border color']) != "undefined" && model['Letter cells border color'] !== "")
            presenter.letterCellsBorderColor = model['Letter cells border color'];

        if(typeof(model['Letter cells border width']) != "undefined" && model['Letter cells border width'] !== "")
            presenter.letterCellsBorderWidth = parseInt(model['Letter cells border width']);

        if(typeof(model['Letter cells border style']) != "undefined" && model['Letter cells border style'] !== "")
            presenter.letterCellsBorderStyle = model['Letter cells border style'];

        if(typeof(model['Word numbers']) != "undefined") {
            if(model['Word numbers'] == "horizontal" || model['Word numbers'] == "both" || model['Word numbers'] === "")
                presenter.wordNumbersHorizontal = true;

            if(model['Word numbers'] == "vertical" || model['Word numbers'] == "both" || model['Word numbers'] === "")
                presenter.wordNumbersVertical = true;
        }

        if(typeof(model['Marked column index']) != "undefined" && model['Marked column index'] !== "") {
            presenter.markedColumnIndex = parseInt(model['Marked column index']);
            if(presenter.markedColumnIndex < 0) {
                return returnErrorMessage(presenter.ERROR_MESSAGES.INVALID_MARKED_COLUMN_INDEX)
            }
        }

        if(typeof(model['Marked row index']) != "undefined" && model['Marked row index'] !== "") {
            presenter.markedRowIndex = parseInt(model['Marked row index']);
            if(presenter.markedRowIndex < 0) {
                return returnErrorMessage(presenter.ERROR_MESSAGES.INVALID_MARKED_ROW_INDEX);
            }
        }

        presenter.disableAutomaticWordNumbering = model['Disable automatic word numberin'] == 'True';

        if(presenter.blankCellsBorderWidth < 0) {
            return returnErrorMessage(presenter.ERROR_MESSAGES.INVALID_BLANK_CELLS_BORDER_WIDTH);
        }

        if(presenter.letterCellsBorderWidth < 0) {
            return returnErrorMessage(presenter.ERROR_MESSAGES.INVALID_LETTER_CELLS_BORDER_WIDTH);
        }

        if(parseInt(model['Columns']) <= 0 || isNaN(parseInt(model['Columns'])) ) {
            return returnErrorMessage(presenter.ERROR_MESSAGES.COLUMNS_NOT_SPECIFIED);
        }

        if(parseInt(model['Rows']) <= 0 || isNaN(parseInt(model['Rows']))) {
            return returnErrorMessage(presenter.ERROR_MESSAGES.ROWS_NOT_SPECIFIED);
        }

        if(parseInt(model['Cell width']) <= 0 || isNaN(parseInt(model['Cell width'])) ) {
            return returnErrorMessage(presenter.ERROR_MESSAGES.CELL_WIDTH_NOT_SPECIFIED);
        }

        if(parseInt(model['Cell height']) <= 0 || isNaN(parseInt(model['Cell height']))) {
            return returnErrorMessage(presenter.ERROR_MESSAGES.CELL_HEIGHT_NOT_SPECIFIED);
        }

        presenter.rowCount        = parseInt(model['Rows']);
        presenter.columnCount     = parseInt(model['Columns']);
        presenter.cellWidth       = parseInt(model['Cell width']);
        presenter.cellHeight      = parseInt(model['Cell height']);

        var rows = model['Crossword'].split("\n");
        if(rows.length != presenter.rowCount) {
            return returnErrorMessage(presenter.ERROR_MESSAGES.INVALID_AMOUNT_OF_ROWS_IN_CROSSWORD);
        }

        for(var i = 0; i < rows.length; i++) {
            if(rows[i].replace(/!/g, "").length != presenter.columnCount) {
                return returnErrorMessage(presenter.ERROR_MESSAGES.INVALID_AMOUNT_OF_COLUMNS_IN_CROSSWORD, { row : i + 1 });
            }

            var line = rows[i];
            var previous = line[0];

            if (line.slice(-1) === '!') {
                return returnErrorMessage(presenter.ERROR_MESSAGES.LAST_CHARACTER_EXCLAMATION_MARK);
            }

            for (var j=1; j<line.length; j++) {
                if (previous === '!') {
                    switch (line[j]) {
                        case '!': return returnErrorMessage(presenter.ERROR_MESSAGES.DOUBLED_EXCLAMATION_MARK); break;
                        case ' ': return returnErrorMessage(presenter.ERROR_MESSAGES.EXCLAMATION_MARK_BEFORE_EMPTY_FIELD); break;
                        default: break;
                    }
                }
                previous = line[j];
            }
        }

        presenter.blockWrongAnswers = presenter.isBlockWrongAnswers(model);

        var autoNavigationPropertyResponse = readModelAutoNavigationMode(model);
        if (!!autoNavigationPropertyResponse) {
            return autoNavigationPropertyResponse;
        }

        return {
            isError: false,
            isVisibleByDefault: ModelValidationUtils.validateBoolean(model['Is Visible']),
        };
    };

    function readModelAutoNavigationMode(model) {
        const selectedMode = model["autoNavigation"];
        if (selectedMode === "Off") {
            autoNavigationMode = AUTO_NAVIGATION_OPTIONS.OFF;
        } else if (selectedMode === "Simple") {
            autoNavigationMode = AUTO_NAVIGATION_OPTIONS.SIMPLE;
        } else if (selectedMode === "Extended") {
            autoNavigationMode = AUTO_NAVIGATION_OPTIONS.EXTENDED;
        } else {
            return returnErrorMessage(
                presenter.ERROR_MESSAGES.NOT_SUPPORTED_SELECTED_AUTO_NAVIGATION_MODE
            );
        }
    }

    presenter.isAutoNavigationInOffMode = function () {
        return autoNavigationMode === AUTO_NAVIGATION_OPTIONS.OFF;
    }

    presenter.isAutoNavigationInSimpleMode = function () {
        return autoNavigationMode === AUTO_NAVIGATION_OPTIONS.SIMPLE;
    }

    presenter.isAutoNavigationInExtendedMode = function () {
        return autoNavigationMode === AUTO_NAVIGATION_OPTIONS.EXTENDED;
    }

    presenter.destroyCommands = function () {
        delete presenter.executeCommand;
        delete presenter.isAllOK;
        delete presenter.isAttempted;
        delete presenter.getMaxScore;
        delete presenter.getScore;
        delete presenter.getErrorCount;
        delete presenter.setShowErrorsMode;
        delete presenter.setWorkMode;
        delete presenter.show;
        delete presenter.hide;
        delete presenter.reset;
        delete presenter.getState;
        delete presenter.setState;
        presenter.isModelValid = false;
    };

    presenter.isBlockWrongAnswers = function (model) {
        return ModelValidationUtils.validateBoolean(model.blockWrongAnswers);
    };

    presenter.upgradeModel = function(model) {
        var upgradedModel = upgradeModelAddShowAllAnswersInGSAModeProperty(model);
        return upgradeModelAddAutoNavigationProperty(upgradedModel);
    };

    function upgradeModelAddShowAllAnswersInGSAModeProperty(model) {
        var upgradedModel = {};
        $.extend(true, upgradedModel, model);

        if(!upgradedModel['showAllAnswersInGradualShowAnswersMode']) {
            upgradedModel['showAllAnswersInGradualShowAnswersMode'] = false;
        }

        return upgradedModel;
    }

    function upgradeModelAddAutoNavigationProperty(model) {
        var upgradedModel = {};
        $.extend(true, upgradedModel, model);

        if(!upgradedModel["autoNavigation"]) {
            upgradedModel["autoNavigation"] = "Extended";
        }

        return upgradedModel;
    }

    presenter.initializeLogic = function(view, model) {
        model = presenter.upgradeModel(model);
        presenter.$view = $(view);
        presenter.ID = model.ID;
        presenter.showAllAnswersInGradualShowAnswersMode = model.showAllAnswersInGradualShowAnswersMode;

        presenter.configuration = presenter.readConfiguration(model);
        if(presenter.configuration.isError) {
            presenter.showErrorMessage(configuration.errorMessage, configuration.errorMessageSubstitutions);
            presenter.destroyCommands();
            return;
        }

        presenter.$view.find(".cell").live("blur", presenter.cellBlurEventHandler);
        presenter.prepareGrid(model);
        presenter.prepareCorrectAnswers();
        presenter.createGrid();
    };

    presenter.validate = function(mode) {
        var wordValid, k, l, score, markedCell;
        var filled = false;
        
        if (presenter.isShowAnswersActive && mode == presenter.VALIDATION_MODE.SHOW_ERRORS) {
            presenter.hideAnswers();
            for(var i = 0; i < presenter.rowCount; i++) {
                for(var j = 0; j < presenter.columnCount; j++) {
                    if(presenter.$view.find('.cell_' + i + 'x' + j + ' input').val() != '' && typeof(presenter.$view.find('.cell_' + i + 'x' + j + ' input').val()) !== "undefined" && presenter.crossword[i][j][0] !== '!') {
                        filled = true;
                    }
                }
            }
            if (!filled) {
                return;
            }
        }

        if(mode == presenter.VALIDATION_MODE.SHOW_ERRORS) {
            presenter.$view.find(".cell_letter input").attr('disabled', true);
        } else if(mode == presenter.VALIDATION_MODE.COUNT_SCORE) {
            score = 0;
        }

        for(i = 0; i < presenter.rowCount; i++) {
            for(j = 0; j < presenter.columnCount; j++) {
                if(presenter.isHorizontalWordBegin(i, j)) {
                    wordValid = true;

                    for(k = j; k < presenter.columnCount; k++) {
                        if(presenter.crossword[i][k] == ' ') {
                            break;
                        }

                        if(presenter.crossword[i][k] != presenter.$view.find('.cell_' + i + 'x' + k + " input").attr('value').toUpperCase() && presenter.crossword[i][k][0] !== '!') {
                            wordValid = false;
                        }
                    }

                    if(mode == presenter.VALIDATION_MODE.COUNT_SCORE && wordValid) {
                        score++;
                    }

                    if(mode == presenter.VALIDATION_MODE.SHOW_ERRORS) {
                        for(l = j; l < k; l++) {
                            markedCell = presenter.$view.find('.cell_' + i + 'x' + l);
                            if(!markedCell.hasClass('cell_valid'))
                                markedCell.addClass('cell_' + (wordValid ? 'valid' : 'invalid'));

                            if(wordValid && markedCell.hasClass('cell_invalid'))
                                markedCell.removeClass('cell_invalid');
                        }
                    }
                }

                if(presenter.isVerticalWordBegin(i, j)) {
                    wordValid = true;

                    for(k = i; k < presenter.rowCount; k++) {
                        if(presenter.crossword[k][j] == ' ') {
                            break;
                        }

                        if(presenter.crossword[k][j] != presenter.$view.find('.cell_' + k + 'x' + j + " input").attr('value').toUpperCase() && presenter.crossword[k][j][0] !== '!') {
                            wordValid = false;
                        }
                    }

                    if(mode == presenter.VALIDATION_MODE.COUNT_SCORE && wordValid) {
                        score++;
                    }

                    if(mode == presenter.VALIDATION_MODE.SHOW_ERRORS) {
                        for(l = i; l < k; l++) {
                            markedCell = presenter.$view.find('.cell_' + l + 'x' + j);
                            if(!markedCell.hasClass('cell_valid'))
                                markedCell.addClass('cell_' + (wordValid ? 'valid' : 'invalid'));

                            if(wordValid && markedCell.hasClass('cell_invalid'))
                                markedCell.removeClass('cell_invalid');

                        }
                    }
                }

            }
        }

        if(mode == presenter.VALIDATION_MODE.COUNT_SCORE) {
            return score;
        }
    };

    presenter.setShowErrorsMode = function() {
        if (!presenter.isAttempted()) {
            return;
        }

        presenter.validate(presenter.VALIDATION_MODE.SHOW_ERRORS);
    };

    presenter.setWorkMode = function() {
        presenter.$view.find(".cell_letter:not(.cell_constant_letter) input").attr('disabled', false);
        presenter.$view.find(".cell_valid").removeClass("cell_valid");
        presenter.$view.find(".cell_invalid").removeClass("cell_invalid");
    };

    presenter.cellBlurEventHandler = function () {
        if (presenter.isAllOK()) {
            presenter.sendAllOKEvent();
        }
    };

    presenter.run = function(view, model) {
        presenter.preview = false;
        presenter.addonID = model.ID
        presenter.initializeLogic(view, model);
        if (!presenter.configuration.isError) {
            presenter.setVisibility(presenter.configuration.isVisibleByDefault);
       }
    };

    presenter.setEventBus = function (wrappedEventBus) {
        eventBus = wrappedEventBus;

        var events = ['ShowAnswers', 'HideAnswers', 'GradualShowAnswers', 'GradualHideAnswers'];
        for (var i = 0; i < events.length; i++) {
            eventBus.addEventListener(events[i], this);
        }
    };

    presenter.createPreview = function(view, model) {
        presenter.preview = true;
        presenter.initializeLogic(view, model);
        if (!presenter.configuration.isError) {
            presenter.setVisibility(true);
        }
    };

    presenter.reset = function() {
        if (presenter.isShowAnswersActive) {
            presenter.hideAnswers();
        }
        resetCellsStates()
        presenter.setVisibility(presenter.configuration.isVisibleByDefault);
        presenter.setWorkMode();
    };

    function resetCellsStates() {
        for(var i = 0; i < presenter.rowCount; i++) {
            for(var j = 0; j < presenter.columnCount; j++) {
                if(presenter.crossword[i][j][0] !== '!') {
                    presenter.$view.find('.cell_' + i + 'x' + j + ' input').val('');
                }
                if(typeof(presenter.userAnswers) !== "undefined") {
                    presenter.userAnswers[i][j] = '';
                }
             }
        }
    }

    presenter.setVisibility = function(isVisible) {
        presenter.isVisible = isVisible;
        presenter.$view.css("visibility", isVisible ? "visible" : "hidden");
    };

    presenter.show = function() {
        if(presenter.isShowAnswersActive === true){
            presenter.hideAnswers();
        }
        presenter.setVisibility(true);
    };

    presenter.hide = function() {
        if(presenter.isShowAnswersActive === true){
            presenter.hideAnswers();
        }
        presenter.setVisibility(false);
    };

    presenter.isAttempted = function() {
        var countedConstantLetters = 0;

        jQuery.each(presenter.$view.find('.cell input'), function() {
            if (!ModelValidationUtils.isStringEmpty($(this).val())) countedConstantLetters++;
        });

        return presenter.numberOfConstantLetters < countedConstantLetters;
    };

    presenter.getScore = function() {
        const restoreState = presenter.isShowAnswersActive;

        if (presenter.isShowAnswersActive) {
            presenter.hideAnswers();
        }
        var score = presenter.validate(presenter.VALIDATION_MODE.COUNT_SCORE);
        var finalScore = presenter.isAttempted() ? score : 0;
        if (restoreState) {
            presenter.showAnswers();
        }
        return finalScore;
    };

    presenter.getMaxScore = function() {
        return presenter.maxScore;
    };

    presenter.getErrorCount = function() {
        const restoreState = presenter.isShowAnswersActive;
        if (presenter.isShowAnswersActive) {
            presenter.hideAnswers();
        }
        var score = presenter.validate(presenter.VALIDATION_MODE.COUNT_SCORE),
            errorCount = presenter.getMaxScore() - score;
        var finalErrorCount = presenter.isAttempted() ? errorCount : 0;
        if (restoreState) {
            presenter.showAnswers();
        }
        return finalErrorCount
    };

    presenter.getState = function() {
        if (presenter.isShowAnswersActive) {
            presenter.hideAnswers();
        }
        var cells = getCellsStates();
        var isVisible = presenter.isVisible;

        return JSON.stringify({
            cells : cells,
            isVisible : isVisible
        });
    };

    function getCellsStates() {
        var s = [];
        var cell;
        for(var i = 0; i < presenter.rowCount; i++) {
            for(var j = 0; j < presenter.columnCount; j++) {
                cell = presenter.$view.find('.cell_' + i + 'x' + j + ' input').attr('value');
                if(typeof(cell) == "string")
                    cell = cell.replace("\"", "\\\"");

                s.push(cell);
            }
        }
        return s;
    }

    presenter.setState = function(state) {
        var parsedState = $.parseJSON(state.toString());
        if (parsedState.hasOwnProperty("cells")) {
            setCellsStates(parsedState.cells);
        } else {
            setCellsStates(parsedState);
        }

        if (parsedState.hasOwnProperty("isVisible")) {
            if (typeof(parsedState.isVisible) === "boolean") {
                presenter.isVisible = parsedState.isVisible;
            } else {
                presenter.isVisible = presenter.configuration.isVisibleByDefault;
            }
            presenter.setVisibility(presenter.isVisible);
        }
    };

    function setCellsStates(cellsStates) {
        var counter = 0;
        for(var i = 0; i < presenter.rowCount; i++) {
            for(var j = 0; j < presenter.columnCount; j++) {
                presenter.$view.find('.cell_' + i + 'x' + j + ' input').attr('value', cellsStates[counter]);
                counter++;
            }
        }
    }

    presenter.setPlayerController = function (controller) {
        playerController = controller;
    };

    presenter.executeCommand = function (name, params) {
        if (presenter.configuration.isErrorMode) return;

        var commands = {
            'isAllOK': presenter.isAllOK,
            'show': presenter.show,
            'hide': presenter.hide
        };

        return Commands.dispatch(commands, name, params, presenter);
    };

    presenter.isAllOK = function() {
        if (presenter.wordNumbersHorizontal || presenter.wordNumbersVertical) {
            return presenter.getMaxScore() === presenter.getScore() && presenter.getErrorCount() === 0;
        }else{
            return false;
        }
    };

    function getEventObject(it, val, sc) {
        return {
            'source': presenter.ID,
            'item': '' + it,
            'value': '' + val,
            'score': '' + sc
        };
    }

    presenter.sendAllOKEvent = function () {
        eventBus.sendEvent('ValueChanged', getEventObject('all', '', ''));
    };

    presenter.sendCorrectWordEvent = function sendCorrectWordEvent (word, item) {
        eventBus.sendEvent('CorrectWord', getEventObject(item, word, ''));
    };

    presenter.sendScoreEvent = function(pos, value, isOk) {
        var item = '[row][col]'.replace('col', pos.x + 1).replace('row', pos.y + 1);
        var score = isOk ? '1' : '0';
        eventBus.sendEvent('ValueChanged', getEventObject(item, value, score));
    };

    presenter.validateWord = function validateWord(pos) {
        var max_x = pos.x;
        var max_y = pos.y;
        var i, k, result = {
            word: '',
            item: 0,
            valid : false
        };

        if (presenter.wordNumbersHorizontal) {
            for (i = 0; i <= max_x; i++) {
                if (!presenter.isHorizontalWordBegin(max_y, i)) {
                    continue;
                }
                for (k = i; k < presenter.columnCount; k++) {
                    if(presenter.crossword[max_y][k] == ' ') {
                        break;
                    }
                    if(presenter.crossword[max_y][k] != presenter.$view.find('.cell_' + max_y + 'x' + k + " input").attr('value').toUpperCase() && presenter.crossword[max_y][k][0] !== '!') {
                        result.word = '';
                        break;
                    }
                    result.word += presenter.crossword[max_y][k];
                }
                result.item = presenter.$view.find('.cell_' + max_y + 'x' + i +' .word_number').text();
                break;
            }
        }

        if (presenter.wordNumbersVertical) {
            for (i = 0; i <= max_y; i++) {
                if (!presenter.isVerticalWordBegin(i, max_x)) {
                    continue;
                }
                for (k = i; k < presenter.rowCount; k++) {
                    if(presenter.crossword[k][max_x] == ' ') {
                        break;
                    }
                    if(presenter.crossword[k][max_x] != presenter.$view.find('.cell_' + k + 'x' + max_x + " input").attr('value').toUpperCase() && presenter.crossword[k][max_x][0] !== '!') {
                        result.word = '';
                        break;
                    }
                    result.word += presenter.crossword[k][max_x];
                }
                result.item = presenter.$view.find('.cell_' + i + 'x' + max_x +' .word_number').text();
                break;
            }
        }

        if (result.word != '' ) {
            result.valid = true;
        }

        return result
    };

    presenter.getActivitiesCount = function() {
        if(presenter.showAllAnswersInGradualShowAnswersMode === "True") {
            return 1;
        }
        return presenter.correctAnswers.length;
    }

    presenter.onEventReceived = function (eventName, data) {
        if (!presenter.isModelValid) return;
        if (eventName === "ShowAnswers") {
            presenter.showAnswers();
        } else if (eventName === "HideAnswers") {
            presenter.hideAnswers();
        } else if (eventName === "GradualShowAnswers") {
            if (!presenter.isGradualShowAnswersActive) {
                presenter.isGradualShowAnswersActive = true;
            }
            if (data.moduleID === presenter.addonID) {
                presenter.gradualShowAnswers(parseInt(data.item, 10));
            }
        } else if (eventName === "GradualHideAnswers") {
            presenter.isGradualShowAnswersActive = false;
            presenter.hideAnswers();
        }
    };

    presenter.showAnswers = function () {
        if (presenter.wordNumbersHorizontal || presenter.wordNumbersVertical) {
            if (presenter.isShowAnswersActive) {
                presenter.hideAnswers();
            }
            presenter.isShowAnswersActive = true;
            presenter.setWorkMode();
            presenter.userAnswers = new Array(presenter.rowCount);
            presenter.$view.find(".cell_letter input:enabled").attr('disabled', true);
            presenter.$view.find(".cell_letter input").addClass('crossword_cell_show-answers');

            for (var i = 0; i < presenter.rowCount; i++) {
                presenter.userAnswers[i] = new Array(presenter.columnCount);
                for(var j = 0; j < presenter.columnCount; j++) {
                    presenter.userAnswers[i][j] = presenter.$view.find('.cell_' + i + 'x' + j + ' input').val();
                    presenter.$view.find('.cell_' + i + 'x' + j + ' input').val(presenter.crossword[i][j].replace(/[!]/g,""));
                }
            }
        }
    };
    
    presenter.hideAnswers = function () {
        if ((presenter.wordNumbersHorizontal || presenter.wordNumbersVertical) && presenter.isShowAnswersActive) {
            presenter.isShowAnswersActive = false;
            presenter.$view.find(".cell_letter input").removeClass('crossword_cell_show-answers');
            if (!presenter.userAnswers) {
                return;
            }
            for (var i = 0; i < presenter.rowCount; i++) {
                for (var j = 0; j < presenter.columnCount; j++) {
                    if (!presenter.crossword[i][j][0].includes('!')) {
                        presenter.$view.find(`.cell_${i}x${j} input`)
                            .val(presenter.userAnswers[i][j])
                            .attr('disabled', false);
                    }
                }
            }
        }
    };

    presenter.gradualShowAnswers = function (itemIndex) {
        if (presenter.showAllAnswersInGradualShowAnswersMode === "True") {
            presenter.showAnswers();
        }
        else {
            if (presenter.wordNumbersHorizontal || presenter.wordNumbersVertical) {
                if(itemIndex == 0) {
                    presenter.prepareCrosswordForGSA();
                }
                var answerData = presenter.correctAnswers[itemIndex];
                var answer = answerData.answer;
                var x = answerData.position.x;
                var y = answerData.position.y;
                if (answerData.isHorizontal) {
                    for (var i = 0; i < answer.length; i++) {
                        presenter.$view.find('.cell_' + y + 'x' + (x + i) + ' input').val(answer.charAt(i));
                    }
                }
                if (!answerData.isHorizontal) {
                    for (var i = 0; i < answer.length; i++) {
                        presenter.$view.find('.cell_' + (y + i) + 'x' + x + ' input').val(answer.charAt(i));
                    }
                }
            }
        }
    }

    presenter.prepareCrosswordForGSA = function () {
        presenter.setWorkMode();
        presenter.$view.find(".cell_letter input:enabled").attr('disabled', true);
        presenter.userAnswers = new Array(presenter.rowCount);
        for(var i = 0; i < presenter.rowCount; i++) {
            presenter.userAnswers[i] = new Array(presenter.columnCount);
            for(var j = 0; j < presenter.columnCount; j++) {
                presenter.userAnswers[i][j] = presenter.$view.find('.cell_' + i + 'x' + j + ' input').val();
            }
        }
    }

    return presenter;
}
