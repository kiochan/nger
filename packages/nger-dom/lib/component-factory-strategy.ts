/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {
  ApplicationRef, ComponentFactory, ComponentFactoryResolver,
  ComponentRef, EventEmitter, OnChanges, SimpleChange,
  SimpleChanges, Type
} from 'nger-core';
import { Injector } from 'nger-di'
import { Observable, merge } from 'rxjs';
import { map } from 'rxjs/operators';

import { NgElementStrategy, NgElementStrategyEvent, NgElementStrategyFactory } from './element-strategy';
import { extractProjectableNodes } from './extract-projectable-nodes';
import { isFunction, scheduler, strictEquals } from './utils';

/** Time in milliseconds to wait before destroying the component ref when disconnected. */
const DESTROY_DELAY = 10;
/**
 * Factory that creates new ComponentNgElementStrategy instance. Gets the component factory with the
 * constructor's injector's factory resolver and passes that factory to each strategy.
 *
 * @publicApi
 */
export class ComponentNgElementStrategyFactory<T> implements NgElementStrategyFactory {
  componentFactory: ComponentFactory<T>;
  constructor(private component: Type<T>, private injector: Injector) {
    this.componentFactory =
      injector.get(ComponentFactoryResolver).resolveComponentFactory<T>(component);
  }
  create(injector: Injector) {
    return new ComponentNgElementStrategy(this.componentFactory, injector);
  }
}

/**
 * Creates and destroys a component ref using a component factory and handles change detection
 * in response to input changes.
 *
 * @publicApi
 */
export class ComponentNgElementStrategy<T> implements NgElementStrategy {
  events !: Observable<NgElementStrategyEvent>;
  private componentRef !: ComponentRef<T> | null;
  private inputChanges: SimpleChanges | null = null;
  private implementsOnChanges = false;
  private scheduledChangeDetectionFn: (() => void) | null = null;
  private scheduledDestroyFn: (() => void) | null = null;
  private readonly initialInputValues = new Map<string, any>();
  private readonly uninitializedInputs = new Set<string>();
  constructor(private componentFactory: ComponentFactory<T>, private injector: Injector) { }

  /**
   * Initializes a new component if one has not yet been created and cancels any scheduled
   * destruction.
   */
  connect(element: HTMLElement) {
    // If the element is marked to be destroyed, cancel the task since the component was reconnected
    if (this.scheduledDestroyFn !== null) {
      this.scheduledDestroyFn();
      this.scheduledDestroyFn = null;
      return;
    }
    if (!this.componentRef) {
      this.initializeComponent(element);
    }
  }

  /**
   * Schedules the component to be destroyed after some small delay in case the element is just
   * being moved across the DOM.
   */
  disconnect() {
    // Return if there is no componentRef or the component is already scheduled for destruction
    if (!this.componentRef || this.scheduledDestroyFn !== null) {
      return;
    }
    // Schedule the component to be destroyed after a small timeout in case it is being
    // moved elsewhere in the DOM
    this.scheduledDestroyFn = scheduler.schedule(() => {
      if (this.componentRef) {
        this.componentRef!.destroy();
        this.componentRef = null;
      }
    }, DESTROY_DELAY);
  }

  /**
   * Returns the component property value. If the component has not yet been created, the value is
   * retrieved from the cached initialization values.
   */
  getInputValue(property: string): any {
    if (!this.componentRef) {
      return this.initialInputValues.get(property);
    }

    return (this.componentRef.instance as any)[property];
  }

  /**
   * Sets the input value for the property. If the component has not yet been created, the value is
   * cached and set when the component is created.
   */
  setInputValue(property: string, value: any): void {
    if (strictEquals(value, this.getInputValue(property))) {
      return;
    }

    if (!this.componentRef) {
      this.initialInputValues.set(property, value);
      return;
    }

    this.recordInputChange(property, value);
    (this.componentRef.instance as any)[property] = value;
    this.scheduleDetectChanges();
  }

  /**
   * Creates a new component through the component factory with the provided element host and
   * sets up its initial inputs, listens for outputs changes, and runs an initial change detection.
   */
  protected initializeComponent(element: HTMLElement) {
    const childInjector = Injector.create({ providers: [], parent: this.injector });
    // 项目node elements
    const projectableNodes =
      extractProjectableNodes(element, this.componentFactory.ngContentSelectors);
    // element
    this.componentRef = this.componentFactory.create(childInjector);
    // host view
    this.implementsOnChanges =
      isFunction((this.componentRef.instance as any as OnChanges).ngOnChanges);
    this.initializeInputs();
    this.initializeOutputs();
    this.detectChanges();
    const applicationRef = this.injector.get<ApplicationRef>(ApplicationRef);
    // 挂载页面
    applicationRef.attachView(this.componentRef, childInjector);
  }

  /** Set any stored initial inputs on the component's properties. */
  protected initializeInputs(): void {
    this.componentFactory.inputs.forEach(({ propName }) => {
      const initialValue = this.initialInputValues.get(propName);
      if (initialValue) {
        this.setInputValue(propName, initialValue);
      } else {
        this.uninitializedInputs.add(propName);
      }
    });
    this.initialInputValues.clear();
  }

  /** Sets up listeners for the component's outputs so that the events stream emits the events. */
  protected initializeOutputs(): void {
    const eventEmitters = this.componentFactory.outputs.map(({ propName, templateName }) => {
      const emitter = (this.componentRef!.instance as any)[propName] as EventEmitter<any>;
      return emitter.pipe(map((value: any) => ({ name: templateName, value })));
    });
    this.events = merge(...eventEmitters);
  }

  /** Calls ngOnChanges with all the inputs that have changed since the last call. */
  protected callNgOnChanges(): void {
    if (!this.implementsOnChanges || this.inputChanges === null) {
      return;
    }
    const inputChanges = this.inputChanges;
    this.inputChanges = null;
    (this.componentRef!.instance as any as OnChanges).ngOnChanges(inputChanges);
  }

  /**
   * Schedules change detection to run on the component.
   * Ignores subsequent calls if already scheduled.
   */
  protected scheduleDetectChanges(): void {
    if (this.scheduledChangeDetectionFn) {
      return;
    }
    this.scheduledChangeDetectionFn = scheduler.scheduleBeforeRender(() => {
      this.scheduledChangeDetectionFn = null;
      this.detectChanges();
    });
  }

  /**
   * Records input changes so that the component receives SimpleChanges in its onChanges function.
   */
  protected recordInputChange(property: string, currentValue: any): void {
    // Do not record the change if the component does not implement `OnChanges`.
    if (this.componentRef && !this.implementsOnChanges) {
      return;
    }

    if (this.inputChanges === null) {
      this.inputChanges = {};
    }

    // If there already is a change, modify the current value to match but leave the values for
    // previousValue and isFirstChange.
    const pendingChange = this.inputChanges[property];
    if (pendingChange) {
      pendingChange.currentValue = currentValue;
      return;
    }

    const isFirstChange = this.uninitializedInputs.has(property);
    this.uninitializedInputs.delete(property);

    const previousValue = isFirstChange ? undefined : this.getInputValue(property);
    this.inputChanges[property] = new SimpleChange(previousValue, currentValue, isFirstChange);
  }

  /** Runs change detection on the component. */
  protected detectChanges(): void {
    if (!this.componentRef) {
      return;
    }
    this.callNgOnChanges();
    this.componentRef!.changeDetectorRef.detectChanges();
  }
}
