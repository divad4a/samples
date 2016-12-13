import { endpoint, configuration, rates, interval } from './config';

import React from 'react';
import ReactDOM from 'react-dom';

var e = React.createElement

class CurrencySelector extends React.Component{
	constructor(props={currencies:{}, defaultSelection:''}) {
		super();
		this.state=props;
	}
	
	render(){
		
		var options = [e('option', {'className':'option', 'value':''}, 'All')];
		
		for(var code in this.state.currencies){
			options.push(e('option', {'className':'option', 'value':code}, this.state.currencies[code]+'-'+code));
		}
		
		return e('select', {'className': 'options', onChange:onCurrencyChange, defaultValue:this.state.defaultSelection}, options);
	}
	
	_setState(state){
		this.setState(state);
	}
}

function ExchangeRateLine(state) {	  
	return e('div', {'className': state.isHead==true?'tableRow tableHead':'tableRow'}, 
			e('div' ,{'className':'tableCell currencyName'},state.name1), 
			e('div' ,{'className':'tableCell currencyCode'},state.code1), 
			e('div' ,{'className':'tableCell currencyName'},state.name2), 
			e('div' ,{'className':'tableCell currencyCode'},state.code2), 
			e('div' ,{'className':'tableCell currencyRate'},state.rate), 
			e('div' ,{'className':'tableCell currencyRateTrend'},state.rateTrend===''?'':state.rateTrend>0?'↑':state.rateTrend>0?'↓':'~'));
}

class ExchangeRateTable extends React.Component {
	constructor(props={visibleRows: []}) {
		super();
		this.state=props;
	}
	
	render(){
		var lines = [];
		
		lines.push(e(ExchangeRateLine, {isHead:true, name1:'Currency', code1:'', name2:'Currency', code2:'', rate:'Rate', rateTrend:''}, null));
		for(var index in this.state.visibleRows){
			const rate = ratesList[this.state.visibleRows[index]];
			lines.push(e(ExchangeRateLine, rateToParms(rate), null));
		}
		
		return e('div', {'className':'table'}, lines);
	}
	
	_setState(state){
		this.setState(state);
	}
	
	rerender(){
		this.forceUpdate();
	}
}

class Rate{
	
	constructor(id, currency1, code1, currency2, code2, rate = null, rateTrend=null){
		this.id = id;
		this.currency1 = currency1;
		this.code1 = code1;
		this.currency2 = currency2;
		this.code2 = code2;
		this.rate = rate;
		this.rateTrend = rateTrend;
	}
	
	setRate(rate){
		if(this.rate==undefined || this.rate==rate){
			this.rateTrend = 0;
		}else if(this.rate > rate){
			this.rateTrend = -1;
		}else if(this.rate < rate){
			this.rateTrend = 1;
		}
		this.rate = rate;
	}
	
	hasCode(code){
		return code == this.code1 || code==this.code2;
	}
}

var rateTable;
var currencySelector;
var ratesList = [];

export function run() {
	ratesList = loadRatesList();
	if(ratesList.length == 0){
		loadConfig();
	}
	
	const selectedValue = sessionStorage.getItem('selectedRate');
	console.log('selectedValue');
	console.log(selectedValue);
	
    rateTable = React.createElement(ExchangeRateTable, buildRateTableProps(getVisibleRates(selectedValue)), null);
    rateTable = ReactDOM.render(rateTable, document.getElementById('exchange-rate-table'));
    
    currencySelector = React.createElement(CurrencySelector, buildCurrencySelectorState(ratesList, selectedValue), null);
    currencySelector = ReactDOM.render(currencySelector, document.getElementById('exchange-rate-selector'));
    
    
    startRateChecker(); 
}

function loadRatesList(){
	const array = JSON.parse(sessionStorage.getItem('ratesList'));
	if(typeof array==='undefined' || array==null){
		return [];
	}
	var rates = [];
	for(var key in Object.keys(array)){
		const obj = array[key];
		rates.push(new Rate(obj.id, obj.currency1,obj.code1, obj.currency2, obj.code2, obj.rate, obj.rateTrend));
	}
	return rates;
}

function buildRateTableProps(vr){
	return {visibleRows: vr};
}

function buildCurrencySelectorState(rates, defaultSelection = ''){
	
	var currencies ={};
	
	for(var index in rates){
		const rate = rates[index];
		if(typeof rate !== 'undefined'){
			if(typeof currencies[rate.code1] === 'undefined'){
				currencies[rate.code1] = rate.currency1;
			}
			if(typeof currencies[rate.code2] === 'undefined'){
				currencies[rate.code2] = rate.currency2;
			}
		}
	}
	
	return {currencies: currencies, defaultSelection:defaultSelection};
}

function rateToParms(rate){
	return {name1:rate.currency1,
		code1:rate.code1, 
		name2:rate.currency2, 
		code2:rate.code2, 
		rate:rate.rate, 
		rateTrend: rate.rateTrend,
		isHead:false};
}

function getVisibleRates(selectedValue){
	if(typeof selectedValue === 'undefined' || selectedValue == null || selectedValue == ''){
		return Object.keys(ratesList);
	}
	var visibleRates = [];
	for(var rateIndex in ratesList){
		const rate = ratesList[rateIndex];
		if(rate.hasCode(selectedValue)){
			visibleRates.push(rateIndex);
		}
	}
	
	return visibleRates;
}

function loadConfig(){
	const success = function(data){
		const currencyPairs = data.currencyPairs
		const keys = Object.keys(currencyPairs);
		ratesList = [];
		keys.forEach(function(element, index, array){
			const rate = currencyPairs[element];
			ratesList.push(new Rate(element,rate[0].name, rate[0].code, rate[1].name, rate[1].code));
		});
		
		sessionStorage.setItem('ratesList', JSON.stringify(ratesList));
		
		rateTable._setState(buildRateTableProps(Object.keys(ratesList)));
		
		currencySelector._setState(buildCurrencySelectorState(ratesList));
		
	}
	
	getConfig(success,null);
	
}


var ratesChackerIntervalId;

function startRateChecker(){
	const success = function(data){		
		ratesList.forEach(function(element, index, array){
			const newRate = data.rates[element.id];
			if(typeof newRate !== 'undefined'){
				element.setRate(newRate);
			}
		});		
		
		sessionStorage.setItem('ratesList', JSON.stringify(ratesList));
		rateTable.rerender();
	}
	
	const error = function(code, text){
		console.log(code);
		console.log(text);
	}
	
	const repeatedFunction = function(){
		var ids = [];
		for(var index = 0; index<ratesList.length; index++){
			ids.push(ratesList[index].id);
		}
		getNewRates(ids, success, error);
	}
	
	ratesChackerIntervalId = setInterval(repeatedFunction, interval);
}

function getConfig(successCallback, errorCallback){
	const http = new XMLHttpRequest();
	http.open("GET", endpoint+configuration, true);
	http.setRequestHeader('Accept', 'application/json');
	
	http.onreadystatechange = function() {
	    if(http.readyState == 4 && http.status == 200) {	    	
	    	successCallback(JSON.parse(http.responseText));
	    } else if(http.readyState==4){
	    	errorCallback(http.status, http.responseText);
	    }
	}
	http.send();
}

function getNewRates(ids, successCallback, errorCallback){
	const http = new XMLHttpRequest();
	const url = endpoint+rates+'?'+arrayToReqParms(ids, 'currencyPairIds');
	http.open("GET", url, true);
	
	http.setRequestHeader("Accept", "application/json");
	
	http.onreadystatechange = function() {
	    if(http.readyState == 4 && http.status == 200) {	    	
	    	successCallback(JSON.parse(http.responseText));
	    } else if(http.readyState==4){
	    	errorCallback(http.status, http.responseText);
	    }
	}
	
	
	http.send();
}

function arrayToReqParms(array, parmName){
	var result='';
	for(var index=0;index<array.length;index++){
		if(typeof array[index] !== 'undefined'){
			result=result+'&'+parmName+'='+array[index];
		}
	}
	
	return result.substring(1);
}

function onCurrencyChange(event){
	var selectedValue = event.target.value;
	sessionStorage.setItem('selectedRate', selectedValue);
	if(selectedValue == ''){
		rateTable._setState(buildRateTableProps(Object.keys(ratesList)));	
		return;
	}
	
	rateTable._setState(buildRateTableProps(getVisibleRates(selectedValue)));
}
