import {
    NgModule, NgModuleBootstrap, NgModuleRef,
    DevModelToken, Logger, createPlatformFactory, platformCore
} from 'nger-core'
import { NgerWebpackAdmin } from 'nger-webpack-admin'
import ngerplatformNode from 'nger-platform-node'
import { NgerModuleWebpack, WebpackService } from 'nger-module-webpack'
import dev from 'webpack-dev-server';
import ngerCompilerPreact from 'nger-compiler-preact'
import ngerCompiler from 'nger-compiler'
export class NgerCliBuildAdminBuilderBootstrap extends NgModuleBootstrap {
    constructor(public logger: Logger) {
        super();
    }
    async run(ref: NgModuleRef<any>) {
        this.logger.info(`NgerCliBuildAdminBuilderBootstrap`)
        const webpack = ref.injector.get(WebpackService, null);
        const isDevModel = ref.injector.get(DevModelToken, false);
        this.logger.info(`building admin isDevModel:${isDevModel}`)
        if (isDevModel && webpack) {
            const config = webpack.config;
            let publicPath = '/';
            if (config) {
                if (config.output && config.output.publicPath) publicPath = config.output.publicPath
            }
            return new dev(webpack.compiler, {
                historyApiFallback: true,
                hot: true,
                open: true,
                inline: true,
                publicPath
            }).listen(3001);
        }
    }
}
export default createPlatformFactory(ngerplatformNode, 'buildAdmin', [
    ...ngerCompilerPreact,
    ...ngerCompiler,
    {
        provide: NgModuleBootstrap,
        useClass: NgerCliBuildAdminBuilderBootstrap,
        deps: [Logger],
        multi: true
    },
    {
        provide: DevModelToken,
        useValue: true
    }
])

@NgModule({
    providers: [],
    imports: [
        NgerModuleWebpack,
        NgerWebpackAdmin
    ]
})
export class NgerCliBuildAminBuilder { }
