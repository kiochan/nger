import { makeDecorator, ClassContext, ClassAst } from 'ims-decorator';
import { } from '@angular/router';
import { Route } from './types';
export const PageMetadataKey = 'PageMetadataKey';
import { ComponentOptions } from './component'
export interface PageOptions extends Route, ComponentOptions { }
export const Page = makeDecorator<PageOptions>(PageMetadataKey);
export class PageClassAst extends ClassContext<PageOptions> {
    path: string;
    constructor(ast: any, context: any) {
        super(ast, context)
        const def = this.ast.metadataDef;
        if (def.path) this.path = def.path;
    }
}
export function isPageClassAst(ast: ClassAst): ast is ClassAst<PageOptions> {
    return ast.metadataKey === PageMetadataKey;
}
