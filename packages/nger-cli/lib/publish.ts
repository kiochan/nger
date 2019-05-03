import { Command, Inject, Logger } from 'nger-core'

@Command({
    name: 'publish',
    description: '发布src目录下的应用',
    example: {
        command: 'nger publish',
        description: '发布应用'
    }
})
export class PublishCommand {
    @Inject() logger: Logger;

    run() {
        this.logger.warn(`testing`);
    }
}