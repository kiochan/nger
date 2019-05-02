import { Injector, Type } from 'nger-di'
import { ChangeDetectorRef } from './change_detector_ref';
import { Component, ComponentOptions } from '../decorators/component'
// 这个是真实的组件 P代表react中的Props,S代表State
// 这个是为了更好的融合react/preact才加上的
import { BehaviorSubject } from 'rxjs'
export class ComponentRef<C> {
    get options(): any[] {
        return this._options;
    }
    get injector(): Injector {
        return this._injector;
    }
    get instance(): C {
        return this._instance;
    }
    get componentType(): Type<C> {
        return this._componentType;
    }
    get component(): Component {
        return this._component;
    }
    // 路径
    get location(): any {
        return this._location;
    }
    // 挂载的dom 只有在特定环境下有效
    get hostView(): any {
        return this._hostView;
    }
    get changeDetectorRef(): ChangeDetectorRef {
        return this._changeDetectorRef;
    }
    get props(): BehaviorSubject<any> {
        return this._props
    }
    _options: any[];
    _props: BehaviorSubject<any>;
    _location: any;
    _hostView: any;
    _component: Component;
    constructor(
        private _injector: Injector,
        private _instance: C,
        // todo
        private _changeDetectorRef: ChangeDetectorRef,
        private _componentType: Type<C>,
        _options: any[]
    ) { 
        this._options = _options;
    }
    destroy(): void { }
    onDestroy(callback: Function): void { }
}

